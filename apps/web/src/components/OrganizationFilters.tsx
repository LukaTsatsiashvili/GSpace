import { useEffect,useMemo,useState } from 'react';
import { Select } from './ui';
type Group={id:string;name:string};
type Branch={id:string;name:string;code:string;kind:string;active:boolean;businessUnit:Group|null;brand:Group|null};
const all='All';
const empty='Unclassified';
export function useOrganizationFilter(){
 const [branches,setBranches]=useState<Branch[]>([]);
 const [unit,setUnit]=useState(all);const [brand,setBrand]=useState(all);const [branch,setBranch]=useState(all);
 useEffect(()=>{let live=true;fetch('/api/v1/organization',{credentials:'same-origin',cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Directory unavailable');return r.json();}).then((data:{branches:Branch[]})=>{if(live)setBranches(data.branches);}).catch(()=>{});return()=>{live=false;};},[]);
 const groupName=(g:Group|null)=>g?.name??empty;
 const units=useMemo(()=>[all,...new Set(branches.map(b=>groupName(b.businessUnit)))],[branches]);
 const brands=useMemo(()=>[all,...new Set(branches.filter(b=>unit===all||groupName(b.businessUnit)===unit).map(b=>groupName(b.brand)))],[branches,unit]);
 const visibleBranches=useMemo(()=>branches.filter(b=>(unit===all||groupName(b.businessUnit)===unit)&&(brand===all||groupName(b.brand)===brand)),[branches,unit,brand]);
 const branchOptions=[all,...visibleBranches.map(b=>b.name+' ('+b.code+')')];
 const selectedIds=useMemo(()=>new Set(visibleBranches.filter(b=>branch===all||b.name+' ('+b.code+')'===branch).map(b=>b.id)),[visibleBranches,branch]);
 const matches=(id:string)=>unit===all&&brand===all&&branch===all||selectedIds.has(id);
 const reset=()=>{setUnit(all);setBrand(all);setBranch(all);};
 return {branches,unit,brand,branch,units,brands,branchOptions,matches,reset,setUnit:(v:string)=>{setUnit(v);setBrand(all);setBranch(all);},setBrand:(v:string)=>{setBrand(v);setBranch(all);},setBranch};
}
export function OrganizationFilters({filter,withBranch=true}:{filter:ReturnType<typeof useOrganizationFilter>;withBranch?:boolean}){
 if(!filter.branches.length)return null;
 return <>{filter.units.length>1&&<Select label="Filter business unit" value={filter.unit==='All'?'All business units':filter.unit} options={filter.units.map(x=>x==='All'?'All business units':x)} onChange={v=>filter.setUnit(v==='All business units'?'All':v)}/>}
 {filter.brands.length>1&&<Select label="Filter brand" value={filter.brand==='All'?'All brands':filter.brand} options={filter.brands.map(x=>x==='All'?'All brands':x)} onChange={v=>filter.setBrand(v==='All brands'?'All':v)}/>}
 {withBranch&&<Select label="Filter branch" value={filter.branch==='All'?'All branches':filter.branch} options={filter.branchOptions.map(x=>x==='All'?'All branches':x)} onChange={v=>filter.setBranch(v==='All branches'?'All':v)}/>}</>;
}
