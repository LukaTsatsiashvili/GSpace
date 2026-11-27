import { Prisma, type Resource } from '@prisma/client';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { principal, requireAuth, type AuthPrincipal } from '../security/auth.js';
const router = Router();
const id = z.string().uuid();
const central = (a: AuthPrincipal) => ['SYSTEM_ADMIN','COMPANY_ADMIN'].includes(a.roleKey);
const backOffice = (a:AuthPrincipal) => central(a)||a.roleKey==='ASSET_MANAGER';
const manage = (a: AuthPrincipal) => a.permissions.includes('transfers.manage') && a.roleKey !== 'EMPLOYEE';
const scope = (a: AuthPrincipal): Prisma.BranchTransferWhereInput => central(a) || (a.roleKey==='ASSET_MANAGER' && manage(a)) ? {} : { OR: [{sourceId:a.branchId},{destinationId:a.branchId}] };
const source = (a:AuthPrincipal,t:{sourceId:string}) => manage(a) && (central(a)||a.branchId===t.sourceId);
const receiver = (a:AuthPrincipal,t:{destinationId:string;recipientId:string}) => manage(a) && (['SYSTEM_ADMIN','COMPANY_ADMIN'].includes(a.roleKey)|| (a.branchId===t.destinationId && (a.userId===t.recipientId||a.roleKey==='BRANCH_MANAGER')));
class Conflict extends Error { constructor(public status:number,message:string){super(message);} }
const check = (ok:unknown,message:string,status=409) => {if(!ok)throw new Conflict(status,message);};
const run = (fn:(req:Request,res:Response)=>Promise<void>) => (req:Request,res:Response,next:NextFunction) => {fn(req,res).catch(e=>{if(e instanceof Conflict)res.status(e.status).json({error:{code:'TRANSFER_ERROR',message:e.message}});else if(e instanceof Prisma.PrismaClientKnownRequestError && ['P2034','P2002','P2003'].includes(e.code))res.status(409).json({error:{message:'Record changed. Reload and retry.'}});else next(e);});};
async function tx<T>(fn:(t:Prisma.TransactionClient)=>Promise<T>){return db.$transaction(fn,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}
const include = {source:true,destination:true,sender:{select:{fullName:true}},recipient:{select:{fullName:true}},items:{include:{resource:true}},events:{orderBy:{createdAt:'desc' as const}}} satisfies Prisma.BranchTransferInclude;
type Row = Prisma.BranchTransferGetPayload<{include:typeof include}>;
function actions(a:AuthPrincipal,t:Row){
 const approve=manage(a)&&backOffice(a)&&a.userId!==t.senderId&&t.status==='Pending approval';
 return {approve,dispatch:source(a,t)&&t.status==='Ready to dispatch',cancel:source(a,t)&&['Pending approval','Ready to dispatch'].includes(t.status),arrive:receiver(a,t)&&t.status==='In transit',receipt:receiver(a,t)&&['Awaiting receipt','Partially received','Issue reported'].includes(t.status)};
}
function serialize(t:Row,a:AuthPrincipal){return {id:t.code,key:t.id,sourceId:t.sourceId,destinationId:t.destinationId,source:t.source.name,destination:t.destination.name,sender:t.sender.fullName,recipient:t.recipient.fullName,route:t.route,status:t.status,created:t.createdAt.toISOString(),reason:t.reason,actions:actions(a,t),items:t.items.map(i=>({id:i.resource.assetCode,key:i.id,name:i.resource.name,origin:t.source.name,condition:i.resource.condition,state:i.status==='RECEIVED'?'Received':i.status==='ISSUE'?'Issue reported':i.status==='CANCELLED'?'Cancelled':'Awaiting receipt',notes:i.notes,evidenceName:i.evidenceName})),activity:t.events.map(e=>({title:e.action+' · '+e.actorName,date:e.createdAt.toISOString(),notes:e.notes}))};}
async function event(t:Prisma.TransactionClient,a:AuthPrincipal,transferId:string,action:string,notes=''){
 await t.branchTransferEvent.create({data:{transferId,actorId:a.userId,actorName:a.fullName,action,notes}});
 await t.securityAuditEvent.create({data:{actorUserId:a.userId,action:'TRANSFER_'+action.replace(/ /g,'_').toUpperCase(),success:true,details:JSON.stringify({transferId,notes})}});
}
async function move(t:Prisma.TransactionClient,a:AuthPrincipal,r:Resource,data:Prisma.ResourceUncheckedUpdateManyInput,action:string){
 const result=await t.resource.updateMany({where:{id:r.id,status:r.status,branchId:r.branchId},data});
 check(result.count===1,'Resource changed; reload and retry');
 await t.resourceAuditEvent.create({data:{resourceId:r.id,assetCode:r.assetCode,actorId:a.userId,actorName:a.fullName,action,before:{status:r.status,branchId:r.branchId,location:r.location,condition:r.condition},after:{status:String(data.status??r.status),branchId:String(data.branchId??r.branchId),location:String(data.location??r.location),condition:String(data.condition??r.condition)}}});
}
async function load(t:Prisma.TransactionClient,a:AuthPrincipal,key:string){const row=await t.branchTransfer.findFirst({where:{id:key,...scope(a)},include});if(!row)throw new Conflict(404,'Transfer not found');return row;}
router.use(requireAuth);
router.use((_req,res,next)=>{const a=principal(res);if(!manage(a)&&!a.permissions.includes('audit.view')){res.status(403).json({error:{message:'Transfer access denied'}});return;}next();});
router.get('/lookups',run(async(_req,res)=>{
 const a=principal(res);
 const [branches,assets,people]=await Promise.all([
 db.branch.findMany({where:{active:true,kind:{not:'LEGACY'}},select:{id:true,name:true,code:true,kind:true,businessUnit:{select:{name:true}},brand:{select:{name:true}}}}),
 manage(a)?db.resource.findMany({where:{status:'AVAILABLE',branch:{active:true,kind:{not:'LEGACY'}},...(central(a)?{}:{branchId:a.branchId})},select:{id:true,assetCode:true,name:true,branchId:true}}):[],
 manage(a)?db.user.findMany({where:{active:true,branch:{active:true},role:{active:true,key:{not:'EMPLOYEE'},grants:{some:{permission:{key:'transfers.manage'}}}}},select:{id:true,fullName:true,branchId:true}}):[]
 ]);
 res.json({branches,assets,people,canManage:manage(a),canDirect:manage(a)&&backOffice(a),canExport:a.permissions.includes('reports.export'),ownBranchId:a.branchId,global:central(a)});
}));
router.get('/',run(async(_req,res)=>{const a=principal(res);const rows=await db.branchTransfer.findMany({where:scope(a),include,orderBy:{createdAt:'desc'},take:200});res.json({transfers:rows.map(t=>serialize(t,a))});}));
router.post('/',run(async(req,res)=>{
 const a=principal(res);check(manage(a),'Transfer permission required',403);
 const v=z.object({sourceId:id,destinationId:id,recipientId:id,resourceIds:z.array(id).min(1).max(25),route:z.enum(['Manager approval','Direct dispatch']),reason:z.string().trim().min(1).max(2000)}).strict().parse(req.body);
 check(v.sourceId!==v.destinationId && new Set(v.resourceIds).size===v.resourceIds.length,'Invalid branches or duplicate resources',400);
 check(source(a,v),'Source branch access denied',403);check(v.route!=='Direct dispatch'||backOffice(a),'Direct dispatch requires back-office permission',403);
 const result=await tx(async t=>{
 const branches=await t.branch.count({where:{id:{in:[v.sourceId,v.destinationId]},active:true,kind:{not:'LEGACY'}}});check(branches===2,'Choose classified, active physical branches',400);
 const recipient=await t.user.findFirst({where:{id:v.recipientId,branchId:v.destinationId,active:true,role:{active:true,key:{not:'EMPLOYEE'},grants:{some:{permission:{key:'transfers.manage'}}}}}});check(recipient,'Choose an authorized recipient in the destination',400);
 const destination=await t.branch.findUniqueOrThrow({where:{id:v.destinationId}});
 if(destination.kind==='STORE')check(await t.user.count({where:{id:v.recipientId,role:{key:'BRANCH_MANAGER'}}})===1,'Store recipient must be a Branch Manager',400);
 const assets=await t.resource.findMany({where:{id:{in:v.resourceIds},branchId:v.sourceId,status:'AVAILABLE'}});check(assets.length===v.resourceIds.length,'One or more resources unavailable');
 const counter=await t.branchTransferCounter.upsert({where:{name:'transfer'},create:{name:'transfer',nextNumber:2},update:{nextNumber:{increment:1}}});
 const row=await t.branchTransfer.create({data:{code:'TRF-'+String(counter.nextNumber-1).padStart(5,'0'),sourceId:v.sourceId,destinationId:v.destinationId,recipientId:v.recipientId,senderId:a.userId,route:v.route,reason:v.reason,status:v.route==='Direct dispatch'?'Ready to dispatch':'Pending approval',items:{create:assets.map(r=>({resourceId:r.id}))}}});
 for(const r of assets)await move(t,a,r,{status:'IN_TRANSFER'},'TRANSFER_RESERVED');
 await event(t,a,row.id,'Created',v.reason);return row;
 });res.status(201).json({id:result.id,code:result.code});
}));
router.post('/export',run(async(req,res)=>{
 const a=principal(res);check(a.permissions.includes('reports.export'),'Export permission required',403);
 const {ids}=z.object({ids:z.array(id).min(1).max(200)}).parse(req.body);
 const rows=await db.branchTransfer.findMany({where:{...scope(a),id:{in:ids}},include});check(rows.length===new Set(ids).size,'Unauthorized transfer selection',403);
 const cell=(v:string)=>'"'+(/^[\s]*[=+@\-\t\r]/.test(v)?"'"+v:v).replace(/"/g,'""')+'"';
 const lines=[['Transfer','Source','Destination','Resource','Status','Item status'].map(cell).join(',')];
 for(const r of rows)for(const i of r.items)lines.push([r.code,r.source.name,r.destination.name,i.resource.assetCode,r.status,i.status].map(cell).join(','));
 await db.securityAuditEvent.create({data:{actorUserId:a.userId,success:true,action:'TRANSFERS_EXPORTED',details:JSON.stringify({ids})}});
 res.type('text/csv').attachment('gspace-transfers.csv').send('\uFEFF'+lines.join('\r\n'));
}));
router.post('/:key/action',run(async(req,res)=>{
 const a=principal(res);const v=z.object({action:z.enum(['approve','reject','dispatch','arrive','cancel']),notes:z.string().trim().max(1000).default('')}).parse(req.body);
 await tx(async t=>{
 const row=await load(t,a,req.params.key);const allowed=actions(a,row);
 check(v.action==='reject'?allowed.approve:allowed[v.action],'Action not permitted in current state',403);
 const status={approve:'Ready to dispatch',reject:'Rejected',dispatch:'In transit',arrive:'Awaiting receipt',cancel:'Cancelled'}[v.action];
 if(['reject','cancel'].includes(v.action)){check(v.notes.length>0,'Reason required',400);for(const i of row.items){check(i.resource.status==='IN_TRANSFER','Resource not reserved');await move(t,a,i.resource,{status:'AVAILABLE'},'TRANSFER_RELEASED');}await t.branchTransferItem.updateMany({where:{transferId:row.id},data:{status:'CANCELLED'}});}
 if(v.action==='dispatch'||v.action==='arrive')check(await t.branch.count({where:{id:{in:[row.sourceId,row.destinationId]},active:true}})===2,'Branch inactive');
 await t.branchTransfer.update({where:{id:row.id},data:{status}});await event(t,a,row.id,v.action,v.notes);
 });res.json({ok:true});
}));
router.post('/:key/receipt',run(async(req,res)=>{
 const a=principal(res);
 const {decisions}=z.object({decisions:z.array(z.object({itemId:id,decision:z.enum(['ACCEPT','REPORT_ISSUE']),notes:z.string().trim().max(1000).default(''),damaged:z.boolean().default(false),evidence:z.object({filename:z.string().min(1).max(180),mimeType:z.enum(['image/jpeg','image/png','image/webp']),base64:z.string().max(2900000)}).optional()})).min(1).max(25)}).parse(req.body);
 check(new Set(decisions.map(d=>d.itemId)).size===decisions.length,'Duplicate decisions',400);
 await tx(async t=>{
 const row=await load(t,a,req.params.key);check(actions(a,row).receipt,'Receipt not permitted',403);
 check(await t.branch.count({where:{id:row.destinationId,active:true}})===1,'Destination inactive');
 for(const d of decisions){const i=row.items.find(x=>x.id===d.itemId);if(!i||!['PENDING','ISSUE'].includes(i.status))throw new Conflict(409,'Item already resolved');check(i.resource.status==='IN_TRANSFER','Resource not reserved');
 const evidence=d.evidence?Buffer.from(d.evidence.base64,'base64'):undefined;
 if(evidence){const mime=d.evidence!.mimeType;check(evidence.length>0&&evidence.length<=2097152&&((mime==='image/jpeg'&&evidence[0]===255&&evidence[1]===216&&evidence[2]===255)||(mime==='image/png'&&evidence.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))||(mime==='image/webp'&&evidence.toString('ascii',0,4)==='RIFF'&&evidence.toString('ascii',8,12)==='WEBP')),'Invalid photo',400);}
 if(i.status==='ISSUE'&&d.decision==='REPORT_ISSUE')throw new Conflict(409,'Issue already reported; resolve with acceptance and a note');
 if(d.decision==='REPORT_ISSUE'){check(d.notes.length>0,'Issue comment required',400);check(!(d.damaged||i.resource.condition==='Damaged')||evidence,'Damage requires photo',400);}
 if(i.status==='ISSUE'&&d.decision==='ACCEPT')check(d.notes.length>0,'Resolution note required',400);
 await t.branchTransferItem.update({where:{id:i.id},data:{status:d.decision==='ACCEPT'?'RECEIVED':'ISSUE',notes:d.notes,...(evidence?{evidence,evidenceName:d.evidence!.filename,evidenceMime:d.evidence!.mimeType}:{})}});
 if(d.decision==='REPORT_ISSUE'&&d.damaged)await move(t,a,i.resource,{condition:'Damaged'},'TRANSFER_DAMAGE_REPORTED');
 if(d.decision==='ACCEPT')await move(t,a,i.resource,{status:'AVAILABLE',branchId:row.destinationId,location:'',...(d.damaged?{condition:'Damaged'}:{})},'TRANSFER_RECEIVED');
 await event(t,a,row.id,d.decision+' '+i.resource.assetCode,d.notes);
 }
 const items=await t.branchTransferItem.findMany({where:{transferId:row.id},select:{status:true}});
 const status=items.every(i=>i.status==='RECEIVED')?'Completed':items.some(i=>i.status==='ISSUE')?'Issue reported':items.some(i=>i.status==='RECEIVED')?'Partially received':'Awaiting receipt';
 await t.branchTransfer.update({where:{id:row.id},data:{status}});
 });res.json({ok:true});
}));
router.get('/:key/items/:itemId/evidence',run(async(req,res)=>{const a=principal(res);const row=await load(db,a,req.params.key);const i=row.items.find(x=>x.id===req.params.itemId);if(!i?.evidence)throw new Conflict(404,'Evidence not found');res.setHeader('X-Content-Type-Options','nosniff');res.attachment(i.evidenceName??'photo').type(i.evidenceMime??'application/octet-stream').send(Buffer.from(i.evidence));}));
export default router;
