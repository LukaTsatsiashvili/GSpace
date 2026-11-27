/** Reference-counted document scroll lock for overlapping dialogs. */
let count=0;
let previous='';
export function lockBodyScroll(){
 if(count===0){previous=document.body.style.overflow;document.body.style.overflow='hidden';}
 count++;
 let released=false;
 return ()=>{if(released)return;released=true;count=Math.max(0,count-1);if(count===0)document.body.style.overflow=previous;};
}
