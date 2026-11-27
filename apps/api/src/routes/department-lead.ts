import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth,principal } from '../security/auth.js';
import { currentCustodyByResource } from './resource-custody.js';
const router=Router();
router.get('/',requireAuth,async(_req,res,next)=>{try{
 const a=principal(res);const ids=a.leadDepartmentIds??[];
 if(!ids.length){res.status(403).json({error:{message:'Department lead access required'}});return;}
 const departments=await db.department.findMany({where:{id:{in:ids},active:true,branchId:a.branchId,leadUserId:a.userId},select:{id:true,name:true}});
 const members=await db.user.findMany({where:{active:true,branchId:a.branchId,departmentId:{in:departments.map(d=>d.id)}},select:{id:true,fullName:true,departmentId:true},orderBy:{fullName:'asc'}});
 const memberIds=members.map(m=>m.id);
 const candidates=await db.resource.findMany({where:{branchId:a.branchId,status:'ASSIGNED',assignmentItems:{some:{assignment:{recipientId:{in:memberIds}},status:{in:['PENDING','ACCEPTED','ISSUE_REPORTED','RETURN_REQUESTED','TRANSFER_PENDING']}}}},select:{id:true,assetCode:true,name:true},orderBy:{assetCode:'asc'}});
 const custody=await currentCustodyByResource(candidates.map(r=>r.id));
 const resources=candidates.flatMap(r=>{const c=custody.get(r.id);return c&&memberIds.includes(c.userId)?[{...r,employeeId:c.userId,employeeName:c.userName,status:c.itemStatus}]:[];});
 res.setHeader('Cache-Control','no-store');res.json({departments,members,resources});
}catch(e){next(e);}});
export default router;
