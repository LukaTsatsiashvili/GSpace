/** Store membership and authentication are separate: employees may own assets but never sign in. */
export function canBelongToBranch(roleKey:string,kind:string){return kind!=='STORE'||roleKey==='BRANCH_MANAGER'||roleKey==='EMPLOYEE';}
export function canLoginAtBranch(roleKey:string,kind:string){return roleKey!=='EMPLOYEE'&&canBelongToBranch(roleKey,kind);}
