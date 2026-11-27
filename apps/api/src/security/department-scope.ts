import type { Prisma } from '@prisma/client';
import type { AuthPrincipal } from './auth.js';
export const departmentManager=(a:AuthPrincipal)=>a.roleKey==='EMPLOYEE'&&!!a.leadDepartmentIds?.length;
export const departmentIds=(a:AuthPrincipal)=>a.leadDepartmentIds??[];
export const departmentMatches=(a:AuthPrincipal,id:string|null|undefined)=>!departmentManager(a)||!!id&&departmentIds(a).includes(id);
export const memberScope=(a:AuthPrincipal):Prisma.UserWhereInput=>departmentManager(a)?{departmentId:{in:departmentIds(a)},branchId:a.branchId}:{};
export const resourceDepartmentScope=(a:AuthPrincipal):Prisma.ResourceWhereInput=>departmentManager(a)?{branchId:a.branchId,departmentId:{in:departmentIds(a)},OR:[{status:{not:'ASSIGNED'}},{assignmentItems:{some:{assignment:{recipient:{is:memberScope(a)}},status:{in:['PENDING','ACCEPTED','ISSUE_REPORTED','RETURN_REQUESTED','TRANSFER_PENDING']},NOT:{sourceItemId:{not:null},status:{in:['PENDING','ISSUE_REPORTED']}}}}}]}:{};
export const assignmentDepartmentScope=(a:AuthPrincipal):Prisma.AssignmentWhereInput=>departmentManager(a)?{branchId:a.branchId,recipient:{is:memberScope(a)},items:{every:{resource:{is:resourceDepartmentScope(a)}}}}:{};
export async function canManageDepartmentAssignment(tx:Prisma.TransactionClient,a:AuthPrincipal,id:string){return !departmentManager(a)||!!await tx.assignment.findFirst({where:{id,...assignmentDepartmentScope(a)},select:{id:true}});}
