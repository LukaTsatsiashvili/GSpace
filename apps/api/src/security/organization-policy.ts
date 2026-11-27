/** Employees are custody records; only Branch Managers may sign in from a store. */
export function canLoginAtBranch(roleKey:string,kind:string){return roleKey!=='EMPLOYEE'&&(kind!=='STORE'||roleKey==='BRANCH_MANAGER');}
