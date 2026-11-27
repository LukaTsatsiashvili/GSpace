import { BRANCH_MANAGER_PERMISSIONS } from './access-policy.js';
import type { Prisma } from '@prisma/client';
/** Store membership and authentication are separate. */
export function canBelongToBranch(roleKey:string,kind:string){return kind!=='STORE'||roleKey==='BRANCH_MANAGER'||roleKey==='EMPLOYEE';}
export function canLoginAtBranch(roleKey:string,kind:string,leadDepartmentIds:readonly string[]=[]){return canBelongToBranch(roleKey,kind)&&(roleKey!=='EMPLOYEE'||((kind==='OFFICE'||kind==='LEGACY')&&leadDepartmentIds.length>0));}
export const leadAccessInclude={select:{id:true,branchId:true,active:true}} satisfies Prisma.DepartmentFindManyArgs;
type LoginUser={id:string;active:boolean;branchId:string;role:{key:string;active:boolean};branch:{kind:string;code:string;active:boolean};ledDepartments:{id:string;branchId:string;active:boolean}[]};
export function leadDepartments(user:LoginUser){
 if(!user.active||!user.role.active||!user.branch.active||!(user.branch.kind==='OFFICE'||(user.branch.kind==='LEGACY'&&user.branch.code==='HEAD_OFFICE')))return [];
 return user.ledDepartments.filter(d=>d.active&&d.branchId===user.branchId).map(d=>d.id);
}
export function canLoginUser(user:LoginUser){return user.active&&user.role.active&&user.branch.active&&canLoginAtBranch(user.role.key,user.branch.kind,leadDepartments(user));}
export function effectivePermissions(user:LoginUser,grants:string[]){return user.role.key==='EMPLOYEE'?(leadDepartments(user).length?[...BRANCH_MANAGER_PERMISSIONS]:[]):grants;}
/** On loss of the final qualifying lead appointment, invalidate existing credentials and invitations. */
export async function revokeLostLeadAccess(tx:Prisma.TransactionClient,userId:string|null){
 if(!userId)return;
 const user=await tx.user.findUnique({where:{id:userId},include:{role:true,branch:true,ledDepartments:leadAccessInclude}});
 if(!user||user.role.key!=='EMPLOYEE'||canLoginUser(user))return;
 const now=new Date();
 await tx.session.updateMany({where:{userId,revokedAt:null},data:{revokedAt:now}});
 await tx.accountInvitation.updateMany({where:{userId,usedAt:null},data:{usedAt:now}});
 await tx.userCredential.updateMany({where:{userId},data:{loginDisabled:true}});
}
