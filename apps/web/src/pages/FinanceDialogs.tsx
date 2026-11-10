import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Check, CreditCard, FileText, UploadCloud, X } from 'lucide-react';
import { Badge, Button, Input, NumberInput, Select, Textarea } from '../components/ui';
import {
  assets, bookValue, branches, currencies, expenseTypes, money, paymentStatus, paymentStatuses, remaining,
  type FinancialAsset, type MoneyCurrency, type OperatingExpense, type PaymentStatus
} from './finance-data';

function useFinanceEscape(close: () => void) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('.ui-select[aria-expanded="true"]')) return;
      event.stopImmediatePropagation();
      close();
    };
    document.addEventListener('keydown', handler);
    return () => {document.removeEventListener('keydown', handler); document.body.style.overflow = prev;};
  }, [close]);
}

function ModalHeader({id,eyebrow,title,subtitle,close}: {id:string;eyebrow:string;title:string;subtitle:string;close:()=>void}) {
  return <header className="fn-dialog-header"><div><Badge tone="blue">{eyebrow}</Badge>
    <h2 id={id}>{title}</h2><p>{subtitle}</p></div>
    <button type="button" className="fn-dialog-close" aria-label="Close dialog" onClick={close}><X size={17}/></button>
  </header>;
}
function SummaryGrid({items}: {items:{label:string;value:string}[]}) {
  return <div className="fn-detail-grid">{items.map(item=><div key={item.label}><small>{item.label}</small><strong>{item.value}</strong></div>)}</div>;
}
function Field({name,required=false,children}: {name:string;required?:boolean;children:ReactNode}) {
  return <div className="fn-field"><span>{name}{required && <b> *</b>}</span>{children}</div>;
}
function NoticeContent({title,description,close}: {title:string;description:string;close:()=>void}) {
  return <section className="fn-notice" role="alertdialog" aria-modal="true" aria-labelledby="fn-notice-title" onMouseDown={e=>e.stopPropagation()}>
    <span className="fn-notice-icon"><Check size={23}/></span><h2 id="fn-notice-title">{title}</h2><p>{description}</p>
    <Button variant="primary" onClick={close}>Got it</Button>
  </section>;
}
export function FinanceNotice({title,description,close}: {title:string;description:string;close:()=>void}) {
  useFinanceEscape(close);
  return <div className="fn-notice-overlay" onMouseDown={close}><NoticeContent title={title} description={description} close={close}/></div>;
}
function FilePicker({files,onAdd,onRemove}: {files:File[];onAdd:(items:FileList|null)=>void;onRemove:(index:number)=>void}) {
  const ref=useRef<HTMLInputElement>(null);
  const [dragging,setDragging]=useState(false);
  return <>
    <input ref={ref} className="fn-hidden-file" type="file" multiple aria-label="Choose invoice and receipt files"
      accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={e=>{onAdd(e.target.files);e.target.value='';}}/>
    <button type="button" className={'fn-upload-zone'+(dragging?' dragging':'')} onClick={()=>ref.current?.click()}
      onDragOver={e=>e.preventDefault()} onDragEnter={e=>{e.preventDefault();setDragging(true);}}
      onDragLeave={e=>{e.preventDefault();setDragging(false);}}
      onDrop={e=>{e.preventDefault();setDragging(false);onAdd(e.dataTransfer.files);}}>
      <UploadCloud size={23}/><strong>Choose supporting documents</strong>
      <small>Multiple PDF or image files · preview only</small>
    </button>
    {files.length ? <div className="fn-chosen-files">{files.map((file,index)=><div key={file.name+':'+index}>
      <FileText size={15}/><span>{file.name}</span><button type="button" aria-label={'Remove '+file.name}
        onClick={()=>onRemove(index)}><X size={15}/></button></div>)}</div>
      : <p className="fn-muted-note">No files selected</p>}
  </>;
}

type AssetView = 'details' | 'correct';
export function FinanceAssetDrawer({record,close,onRecordPayment}: {record:FinancialAsset;close:()=>void;onRecordPayment:(record:FinancialAsset)=>void}) {
  const [view,setView]=useState<AssetView>('details');
  const [notice,setNotice]=useState('');
  const [newValue,setNewValue]=useState(String(record.value));
  const [reason,setReason]=useState('');
  const [error,setError]=useState('');
  const closeView=()=>{setError('');if(view==='details')close();else setView('details');};
  useFinanceEscape(()=>{if(notice)setNotice('');else closeView();});

  function previewCorrection() {
    const n=Number(newValue);
    if(!newValue.trim()||!Number.isFinite(n)||n<0){setError('Enter a valid non-negative corrected cost.');return;}
    if(!reason.trim()){setError('A written correction reason is required.');return;}
    setError('');setNotice('Correction preview: '+record.id+' purchase value would change from '+money(record.value,record.currency)+' to '+money(n,record.currency)+'. Reason: '+reason.trim()+'. Original values would be preserved in a production audit trail. No data has changed.');
  }
  const setSubView=(v:AssetView)=>{setView(v);setError('');};

  return <div className="fn-overlay" onMouseDown={close}>
    <aside className="fn-drawer fn-asset-drawer" role="dialog" aria-modal="true" aria-labelledby="fn-asset-title"
      onMouseDown={e=>e.stopPropagation()}>
      <ModalHeader id="fn-asset-title" eyebrow={view==='details'?'FINANCIAL RECORD · '+record.id:'FINANCIAL CORRECTION'}
        title={view==='details'?record.name:'Correct purchase cost'}
        subtitle={view==='details'?'Acquisition, payments, documentation and estimated value.':record.id+' · '+record.name} close={close}/>
      <div className="fn-dialog-body">
        {view==='details' ? <>
          <div className="fn-detail-meta"><span className={'fn-status fn-status-'+paymentStatus(record).toLowerCase().replace(/\s/g,'-')}>{paymentStatus(record)}</span>
            <span>{record.resourceId} · {record.branch}</span></div>
          <SummaryGrid items={[
            {label:'Purchase value',value:money(record.value,record.currency)},{label:'Supplier',value:record.supplier},
            {label:'Acquisition date',value:record.purchaseDate},{label:'Invoice number',value:record.invoice},
            {label:'Paid amount',value:money(record.paid,record.currency)},{label:'Outstanding balance',value:money(remaining(record),record.currency)}
          ]}/>
          <section className="fn-dialog-section"><h3>Depreciation / net value</h3>
            <SummaryGrid items={[
              {label:'Method',value:record.usefulLife?'Straight-line':'Not applicable'},
              {label:'Useful life',value:record.usefulLife?record.usefulLife+' months':'Not applicable'},
              {label:'Accumulated depreciation',value:money(record.depreciation,record.currency)},
              {label:'Estimated book value',value:money(bookValue(record),record.currency)}
            ]}/>
            <p className="fn-muted-note">Management estimate only. This does not represent statutory or tax accounting.</p>
          </section>
          <section className="fn-dialog-section"><h3>Purchase documents</h3><div className="fn-document-list">
            {record.documents.map(name=><button className="fn-document" type="button" key={name}
              onClick={()=>setNotice('This document is a sample attachment reference. '+name+' cannot be downloaded until authenticated file storage is connected.')}>
              <FileText size={18}/><span><strong>{name}</strong><small>Sample attachment reference</small></span></button>)}
          </div></section>
          <section className="fn-dialog-section"><h3>Correction & audit</h3><p className="fn-info-banner">
            Only users with financial edit permission may correct recorded costs. A written reason and audit trail are mandatory; earlier values stay in history.
          </p></section>
        </> : view==='correct' ? <>
          <div className="fn-form-grid">
            <Field name="Current purchase value"><Input aria-label="Current purchase value" readOnly value={money(record.value,record.currency)}/></Field>
            <Field name="Corrected purchase value" required><NumberInput aria-label="Corrected purchase value" min={0} step="0.01"
              value={newValue} onChange={e=>{setNewValue(e.target.value);setError('');}}/></Field>
            <div className="fn-full"><Field name="Correction reason" required><Textarea aria-label="Correction reason" rows={4}
              placeholder="Explain why this value needs correction..." value={reason} onChange={e=>{setReason(e.target.value);setError('');}}/></Field></div>
          </div>
          <p className="fn-info-banner">Historical values and the reason for any correction must be recorded in an audit trail. This action is a preview only.</p>
        </>}
        {error && <p className="fn-error" role="alert">{error}</p>}
      </div>
      <footer className="fn-dialog-footer">
        {view==='details'?<><Button onClick={close}>Close</Button><span className="fn-footer-spacer"/>
          <Button onClick={()=>setSubView('correct')}>Correct cost</Button>
          <Button variant="primary" onClick={()=>onRecordPayment(record)}>Record payment</Button></>
        : <><Button onClick={closeView}>Back</Button><span className="fn-footer-spacer"/>
          <Button variant="primary" onClick={previewCorrection}>Preview correction</Button></>}
      </footer>
      {notice && <div className="fn-notice-overlay" onMouseDown={e=>{e.stopPropagation();setNotice('');}}>
        <NoticeContent title="Design preview" description={notice} close={()=>setNotice('')}/></div>}
    </aside>
  </div>;
}

export function OperatingExpenseDrawer({item,close}: {item:OperatingExpense;close:()=>void}) {
  useFinanceEscape(close);
  return <div className="fn-overlay" onMouseDown={close}><aside className="fn-drawer fn-expense-drawer"
    role="dialog" aria-modal="true" aria-labelledby="fn-expense-title" onMouseDown={e=>e.stopPropagation()}>
    <ModalHeader id="fn-expense-title" eyebrow={'OPERATING EXPENSE · '+item.id} title={item.name}
      subtitle="Resource expense, provider and payment information." close={close}/>
    <div className="fn-dialog-body">
      <SummaryGrid items={[
        {label:'Expense type',value:item.type},{label:'Provider',value:item.provider},
        {label:'Amount',value:money(item.amount,item.currency)},{label:'Status',value:item.status},
        {label:'Branch',value:item.branch},{label:'Date',value:item.date}
      ]}/>
      <p className="fn-info-banner">Related {item.type.toLowerCase()} costs can be traced back to the resource or license history after production integration.</p>
    </div>
    <footer className="fn-dialog-footer fn-footer-right"><Button variant="primary" onClick={close}>Close</Button></footer>
  </aside></div>;
}

export function RecordPaymentDialog({close,initialRecord}: {close:()=>void;initialRecord?:FinancialAsset|null}) {
  const firstPayable = assets.find(item=>remaining(item)>0) ?? assets[0];
  const [invoiceId,setInvoiceId] = useState(initialRecord?.id ?? firstPayable.id);
  const [amount,setAmount] = useState('');
  const [currency,setCurrency] = useState<MoneyCurrency>(initialRecord?.currency ?? firstPayable.currency);
  const [date,setDate] = useState('');
  const [reference,setReference] = useState('');
  const [source,setSource] = useState('Bank transfer');
  const [review,setReview] = useState(false);
  const [notice,setNotice] = useState(false);
  const [error,setError] = useState('');
  const scrollArea=useRef<HTMLDivElement>(null);
  const selected=assets.find(item=>item.id===invoiceId) ?? firstPayable;
  const invoiceLabel=(item:FinancialAsset)=>item.invoice+' · '+item.name;
  const dismiss=()=>{
    if(notice){setNotice(false);return;}
    if(review){setReview(false);scrollArea.current?.scrollTo(0,0);return;}
    close();
  };
  useFinanceEscape(dismiss);
  const changeInvoice=(label:string)=>{
    const next=assets.find(item=>invoiceLabel(item)===label);
    if(!next)return;
    setInvoiceId(next.id);
    setCurrency(next.currency);
    setAmount('');
    setError('');
  };
  const toReview=()=>{
    const balance=remaining(selected),payment=Number(amount);
    if(balance<=0){setError('This invoice is already fully paid. Choose an invoice with an outstanding balance.');return;}
    if(!/^\d+(?:\.\d{1,2})?$/.test(amount.trim())||!Number.isFinite(payment)||payment<=0){
      setError('Enter a valid positive payment amount with at most two decimal places.');return;
    }
    if(currency!==selected.currency){
      setError('For this preview, payment currency must match the invoice currency. FX conversion is not connected.');return;
    }
    if(payment>balance){setError('Payment amount cannot exceed the outstanding balance of '+money(balance,selected.currency)+'.');return;}
    if(date.trim()&&Number.isNaN(Date.parse(date.trim()))){setError('Enter a valid payment date, e.g. Nov 06, 2026.');return;}
    setError('');
    setReview(true);
    scrollArea.current?.scrollTo(0,0);
  };
  return <div className="fn-overlay" onMouseDown={close}>
    <aside className="fn-drawer fn-form-drawer fn-payment-drawer" role="dialog" aria-modal="true"
      aria-labelledby="fn-record-payment-title" onMouseDown={event=>event.stopPropagation()}>
      <ModalHeader id="fn-record-payment-title" close={close}
        eyebrow={review?'PAYMENT REVIEW':'PAYMENT RECORD'}
        title={review?'Review payment':'Record invoice payment'}
        subtitle={review?'Confirm this sample entry before proceeding.':'Update an informational payment status and retain proof.'}/>
      <div className="fn-dialog-body" ref={scrollArea}>
        {review ? <>
          <SummaryGrid items={[
            {label:'Invoice',value:invoiceLabel(selected)},
            {label:'Amount',value:money(Number(amount),currency)},
            {label:'Source',value:source}
          ]}/>
          <p className="fn-info-banner">Preview only. Nothing will be written to a production database or payment provider.</p>
        </> : <>
          <div className="fn-form-grid fn-payment-fields">
            <Field name="Invoice / purchase">
              <Select label="Invoice or purchase" value={invoiceLabel(selected)}
                options={assets.map(invoiceLabel)} onChange={changeInvoice}/>
            </Field>
            <Field name="Payment amount" required>
              <NumberInput aria-label="Payment amount" min={0.01} step={0.01} placeholder="0.00"
                value={amount} onChange={event=>{setAmount(event.target.value);setError('');}}/>
            </Field>
            <Field name="Currency">
              <Select label="Payment currency" value={currency} options={currencies}
                onChange={value=>{setCurrency(value as MoneyCurrency);setError('');}}/>
            </Field>
            <Field name="Payment date">
              <Input aria-label="Payment date" placeholder="e.g. Nov 06, 2026"
                value={date} onChange={event=>{setDate(event.target.value);setError('');}}/>
            </Field>
            <Field name="Payment reference">
              <Input aria-label="Payment reference" placeholder="Receipt or internal reference"
                value={reference} onChange={event=>setReference(event.target.value)}/>
            </Field>
            <Field name="Payment source">
              <Select label="Payment source" value={source}
                options={['Bank transfer','Cash','Card','Other']} onChange={setSource}/>
            </Field>
          </div>
          <p className="fn-info-banner">Payment records are informational: no funds are transferred and no bank account is connected.</p>
          {error && <p className="fn-error" role="alert">{error}</p>}
        </>}
      </div>
      <footer className="fn-dialog-footer">
        {review?<Button onClick={()=>{setReview(false);scrollArea.current?.scrollTo(0,0);}}>Back to edit</Button>
          :<Button onClick={close}>Close</Button>}
        <span className="fn-footer-spacer"/>
        <Button variant="primary" onClick={()=>review?setNotice(true):toReview()}>
          {review?'Confirm preview':'Review payment'} {review?<Check size={15}/>:<ArrowRight size={15}/>}
        </Button>
      </footer>
      {notice && <div className="fn-notice-overlay" onMouseDown={event=>{event.stopPropagation();setNotice(false);}}>
        <NoticeContent title="Payment preview complete"
          description={'Sample payment for '+invoiceLabel(selected)+' — '+money(Number(amount),currency)+' via '+source+
            (date.trim()?' · '+date.trim():'')+(reference.trim()?' · Reference: '+reference.trim():'')+
            '. No production payment, invoice balance, bank transaction or audit record was changed.'}
          close={()=>setNotice(false)}/>
      </div>}
    </aside>
  </div>;
}

export function DepreciationPolicyDialog({close}: {close:()=>void}) {
  const [method,setMethod]=useState('Straight-line');
  const [life,setLife]=useState('48');
  const [startRule,setStartRule]=useState('Acquisition month');
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  useFinanceEscape(()=>{if(notice)setNotice('');else close();});
  const review=()=>{const months=Number(life);if(!Number.isInteger(months)||months<1){setError('Useful life must be a positive number of months.');return;}
    setError('');setNotice('Depreciation policy preview: '+method+', useful life '+months+' months, starting from '+startRule.toLowerCase()+'. No asset valuation or production settings were modified.');
  };
  return <div className="fn-overlay" onMouseDown={close}><aside className="fn-drawer fn-form-drawer" role="dialog" aria-modal="true"
    aria-labelledby="fn-policy-title" onMouseDown={e=>e.stopPropagation()}>
    <ModalHeader id="fn-policy-title" eyebrow="DEPRECIATION POLICY" title="Management depreciation settings"
      subtitle="Configure an illustrative straight-line cost allocation policy." close={close}/>
    <div className="fn-dialog-body">
      <div className="fn-form-grid">
        <Field name="Method"><Select label="Depreciation method" options={['Straight-line']} value={method} onChange={setMethod}/></Field>
        <Field name="Useful life (months)"><NumberInput aria-label="Useful life in months" min={1} step={1}
          value={life} onChange={e=>{setLife(e.target.value);setError('');}}/></Field>
        <Field name="Depreciation begins"><Select label="Depreciation begins" options={['Acquisition month','Following month']}
          value={startRule} onChange={setStartRule}/></Field>
      </div>
      <p className="fn-info-banner">Management estimates only. The preview does not calculate statutory depreciation or update financial records.</p>
      {error && <p className="fn-error" role="alert">{error}</p>}
    </div>
    <footer className="fn-dialog-footer"><Button onClick={close}>Back</Button><span className="fn-footer-spacer"/>
      <Button variant="primary" onClick={review}>Preview policy</Button></footer>
    {notice && <div className="fn-notice-overlay" onMouseDown={e=>{e.stopPropagation();setNotice('');}}>
      <NoticeContent title="Policy preview" description={notice} close={()=>setNotice('')}/></div>}
  </aside></div>;
}

export function NewExpenseDialog({close}: {close:()=>void}) {
  const [name,setName]=useState('');
  const [type,setType]=useState<string>('Maintenance');
  const [resource,setResource]=useState(assets[0].name);
  const [provider,setProvider]=useState('');
  const [amount,setAmount]=useState('');
  const [currency,setCurrency]=useState<MoneyCurrency>('GEL');
  const [status,setStatus]=useState<PaymentStatus>('Unpaid');
  const [date,setDate]=useState('');
  const [files,setFiles]=useState<File[]>([]);
  const [review,setReview]=useState(false);
  const [notice,setNotice]=useState(false);
  const [error,setError]=useState('');
  const body=useRef<HTMLDivElement>(null);
  const addFiles=(items:FileList|null)=>{if(items?.length)setFiles(current=>[...current,...Array.from(items)]);};
  useFinanceEscape(()=>{
    if(notice)setNotice(false);
    else if(review){setReview(false);body.current?.scrollTo(0,0);}
    else close();
  });
  const next=()=>{
    if(!name.trim()||!provider.trim()){setError('Expense name and supplier/provider are required.');return;}
    if(!amount.trim()||!Number.isFinite(Number(amount))||Number(amount)<=0){setError('Enter a positive expense amount.');return;}
    if(date && Number.isNaN(Date.parse(date))){setError('Select a valid expense date.');return;}
    setError('');setReview(true);body.current?.scrollTo(0,0);
  };
  return <div className="fn-overlay" onMouseDown={close}><aside className="fn-drawer fn-form-drawer"
    role="dialog" aria-modal="true" aria-labelledby="fn-add-expense-title" onMouseDown={e=>e.stopPropagation()}>
    <ModalHeader id="fn-add-expense-title" eyebrow={review?'EXPENSE REVIEW':'NEW OPERATING EXPENSE'}
      title={review?'Review operating expense':'Add resource-related expense'}
      subtitle={review?'Confirm this sample entry before proceeding.':'Log service, repair or subscription spend.'} close={close}/>
    <div className="fn-dialog-body" ref={body}>{review ? <>
      <SummaryGrid items={[
        {label:'Expense',value:name.trim()},{label:'Supplier',value:provider.trim()},
        {label:'Amount',value:money(Number(amount),currency)},{label:'Status',value:status},
        {label:'Type',value:type},{label:'Related resource',value:resource},
        {label:'Expense date',value:date||'Not specified'},{label:'Documents',value:files.length+' selected'}
      ]}/>
      <p className="fn-info-banner">Preview only. Nothing will be written to a production database or payment provider.</p>
    </> : <>
      <div className="fn-form-grid">
        <Field name="Expense name" required><Input aria-label="Expense name" placeholder="e.g. Laptop battery replacement" value={name}
          onChange={e=>{setName(e.target.value);setError('');}}/></Field>
        <Field name="Expense type"><Select label="Expense type" options={expenseTypes} value={type} onChange={setType}/></Field>
        <Field name="Related resource"><Select label="Related resource" options={assets.map(item=>item.name)}
          value={resource} onChange={setResource}/></Field>
        <Field name="Supplier / provider" required><Input aria-label="Supplier or provider" placeholder="Enter service provider"
          value={provider} onChange={e=>{setProvider(e.target.value);setError('');}}/></Field>
        <Field name="Amount" required><NumberInput aria-label="Amount" min={0.01} step={0.01} placeholder="0.00"
          value={amount} onChange={e=>{setAmount(e.target.value);setError('');}}/></Field>
        <Field name="Currency"><Select label="Currency" options={currencies} value={currency}
          onChange={v=>setCurrency(v as MoneyCurrency)}/></Field>
        <Field name="Payment status"><Select label="Payment status" options={paymentStatuses} value={status}
          onChange={v=>setStatus(v as PaymentStatus)}/></Field>
        <Field name="Expense date"><Input aria-label="Expense date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field>
      </div>
      <section className="fn-dialog-section"><h3>Invoice / receipt</h3>
        <FilePicker files={files} onAdd={addFiles} onRemove={index=>setFiles(current=>current.filter((_,i)=>i!==index))}/>
      </section>
      <p className="fn-info-banner">Expenses are linked to resource history and remain subject to financial permissions and audit.</p>
      {error && <p className="fn-error" role="alert">{error}</p>}
    </>}</div>
    <footer className="fn-dialog-footer">
      {review?<Button onClick={()=>{setReview(false);body.current?.scrollTo(0,0);}}>Back to edit</Button>
        :<span className="fn-footer-hint">Sample-only action</span>}
      <span className="fn-footer-spacer"/>
      <Button variant="primary" onClick={()=>review?setNotice(true):next()}>{review?'Confirm preview':'Review expense'} <ArrowRight size={15}/></Button>
    </footer>
    {notice && <div className="fn-notice-overlay" onMouseDown={e=>{e.stopPropagation();setNotice(false);}}>
      <NoticeContent title="Expense preview complete" description="The new operating expense was reviewed. No production expense, payment, document or audit record has been created." close={()=>setNotice(false)}/></div>}
  </aside></div>;
}
