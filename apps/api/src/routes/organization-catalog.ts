import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth,principal } from '../security/auth.js';
const router=Router();
router.get('/',requireAuth,async(_req,res,next)=>{try{
 const a=principal(res);
 // Branch directory metadata only, not access to users, resources or operational records.
 // Back-office reviewers need the branch labels for cross-branch requests.
 const all=['SYSTEM_ADMIN','COMPANY_ADMIN'].includes(a.roleKey)||(a.roleKey!=='BRANCH_MANAGER'&&a.permissions.includes('approvals.review'));
 const related=a.permissions.includes('transfers.manage')&&!all?await db.branchTransfer.findMany({where:{OR:[{sourceId:a.branchId},{destinationId:a.branchId}]},select:{sourceId:true,destinationId:true},distinct:['sourceId','destinationId']}):[];
 const branches=await db.branch.findMany({where:all?{}:{id:{in:[a.branchId,...related.flatMap(t=>[t.sourceId,t.destinationId])]}},select:{id:true,name:true,code:true,kind:true,active:true,businessUnit:{select:{id:true,name:true}},brand:{select:{id:true,name:true}}},orderBy:{name:'asc'}});
 res.setHeader('Cache-Control','no-store');res.json({branches});
}catch(e){next(e);}});
export default router;
