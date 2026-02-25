import { useState, useRef, useEffect } from "react";

const C = {
  bg:"#1E1E1E",surface:"#252526",raised:"#2D2D2D",border:"#1A1A1A",
  divider:"rgba(255,255,255,0.06)",input:"#3C3C3C",teal:"#4EC9B0",
  blue:"#569CD6",yellow:"#DCDCAA",orange:"#CE9178",red:"#F44747",
  textHi:"#E8E8E8",textMid:"#CCCCCC",textLo:"#858585",textFaint:"#555555",
};
const MONO="'JetBrains Mono','Fira Code','Consolas',monospace";
const SANS="'Segoe UI',system-ui,sans-serif";

const INIT_CHATS=[
  {id:1,title:"Rust ownership explained",time:"2m ago"},
  {id:2,title:"FastAPI streaming SSE setup",time:"1h ago"},
  {id:3,title:"ChromaDB embedding search",time:"3h ago"},
  {id:4,title:"Electron IPC patterns",time:"Yesterday"},
  {id:5,title:"React 19 compiler notes",time:"2d ago"},
  {id:6,title:"LlamaCpp GPU config",time:"3d ago"},
];

const MESSAGES=[
  {id:1,role:"user",time:"14:32",content:"Can you explain how Rust's ownership system prevents memory leaks?"},
  {id:2,role:"assistant",time:"14:32",sources:["rust-book.pdf","ownership_notes.md"],
    content:"Rust's ownership system is built on three core rules enforced at compile time:\n\n**1. Single Owner** — Every value has exactly one owner. When the owner goes out of scope, the value is dropped and memory is freed automatically.\n\n**2. Move Semantics** — Assigning a value to another variable *moves* ownership. The original binding becomes invalid, preventing double-free bugs.\n\n**3. Borrowing** — You can lend a reference (`&T`) without transferring ownership. The borrow checker ensures references never outlive their owner."},
  {id:3,role:"user",time:"14:34",content:"What's the difference between a move and a clone?"},
  {id:4,role:"assistant",time:"14:34",streaming:true,
    content:"A **move** transfers ownership cheaply — only the pointer/metadata is copied on the stack. A **clone** performs a deep copy of heap data, which can be expensive. Use `.clone()` only when you genuinely need two independent copies."},
];

const MEMORIES=[
  {id:1,text:"User prefers Rust over C++ for systems programming",ts:"2h ago",tag:"preference"},
  {id:2,text:"Working on an Electron desktop app with FastAPI backend",ts:"1d ago",tag:"context"},
  {id:3,text:"Familiar with LangChain and vector databases",ts:"2d ago",tag:"skill"},
  {id:4,text:"Using Ollama locally with llama3.2 model",ts:"3d ago",tag:"config"},
  {id:5,text:"Prefers concise explanations with code examples",ts:"4d ago",tag:"preference"},
  {id:6,text:"Building a RAG pipeline for document Q&A",ts:"5d ago",tag:"context"},
];

const DOCS=[
  {name:"rust-book.pdf",size:"4.2 MB",chunks:142,status:"indexed"},
  {name:"ownership_notes.md",size:"18 KB",chunks:6,status:"indexed"},
  {name:"async_patterns.pdf",size:"1.1 MB",chunks:38,status:"indexing"},
];

const MEM_COLORS={
  preference:{color:C.teal,bg:"rgba(78,201,176,0.1)",border:"rgba(78,201,176,0.2)"},
  context:{color:C.blue,bg:"rgba(86,156,214,0.1)",border:"rgba(86,156,214,0.2)"},
  skill:{color:C.yellow,bg:"rgba(220,220,170,0.1)",border:"rgba(220,220,170,0.2)"},
  config:{color:C.orange,bg:"rgba(206,145,120,0.1)",border:"rgba(206,145,120,0.2)"},
};

// ── Icons ──
const DocIcon=({size=16})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const BrainIcon=({size=16})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5C12 3.34 10.66 2 9 2a3 3 0 0 0-3 3c0 .35.06.69.17 1A3 3 0 0 0 4 9a3 3 0 0 0 1.17 2.37A3 3 0 0 0 6 14a3 3 0 0 0 3 3h1"/>
    <path d="M12 5c0-1.66 1.34-3 3-3a3 3 0 0 1 3 3c0 .35-.06.69-.17 1A3 3 0 0 1 20 9a3 3 0 0 1-1.17 2.37A3 3 0 0 1 18 14a3 3 0 0 1-3 3h-1"/>
    <path d="M9 17v1a3 3 0 0 0 6 0v-1"/>
    <line x1="12" y1="5" x2="12" y2="17"/>
  </svg>
);
const GearIcon=({size=16})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const ChevL=({size=14})=>(<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>);
const ChevR=({size=14})=>(<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>);
const PencilIcon=({size=12})=>(<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>);
const TrashIcon=({size=12})=>(<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>);
const CheckIcon=({size=12})=>(<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>);
const XIcon=({size=12})=>(<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>);
const SendIcon=()=>(<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>);

// ── Primitives ──
const Tag=({label,color,bg,border})=>(
  <span style={{fontSize:9,fontFamily:MONO,letterSpacing:"0.07em",color,background:bg,border:`1px solid ${border}`,borderRadius:3,padding:"1px 6px"}}>{label}</span>
);
const Btn=({onClick,color,active,danger,title,children})=>(
  <button onClick={onClick} title={title} style={{background:"transparent",border:"none",cursor:"pointer",padding:4,borderRadius:4,display:"flex",alignItems:"center",color:danger?C.red:active?(color||C.teal):C.textLo,transition:"color 0.15s"}}>{children}</button>
);

// ── Delete Modal ──
function DeleteModal({title,onConfirm,onCancel}){
  return(
    <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onCancel}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.raised,border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"24px 28px",width:320,boxShadow:"0 24px 64px rgba(0,0,0,0.6)"}}>
        <div style={{fontSize:13,color:C.textHi,fontWeight:600,marginBottom:8,fontFamily:SANS}}>Delete chat?</div>
        <div style={{fontSize:12,color:C.textLo,lineHeight:1.6,marginBottom:20,fontFamily:SANS}}>
          "<span style={{color:C.textMid}}>{title}</span>" will be permanently deleted including all messages and embeddings.
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onCancel} style={{padding:"6px 16px",background:"transparent",border:`1px solid ${C.divider}`,borderRadius:4,color:C.textMid,fontSize:11,cursor:"pointer",fontFamily:MONO}}>Cancel</button>
          <button onClick={onConfirm} style={{padding:"6px 16px",background:"rgba(244,71,71,0.15)",border:"1px solid rgba(244,71,71,0.45)",borderRadius:4,color:C.red,fontSize:11,cursor:"pointer",fontFamily:MONO,fontWeight:600}}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ──
function Sidebar({collapsed,setCollapsed,activeChat,setActiveChat,chatList,setChatList,rightPanel,setRightPanel}){
  const [hovered,setHovered]=useState(null);
  const [renamingId,setRenamingId]=useState(null);
  const [renameVal,setRenameVal]=useState("");
  const [deleteTarget,setDeleteTarget]=useState(null);
  const inputRef=useRef(null);
  useEffect(()=>{if(renamingId&&inputRef.current)inputRef.current.focus();},[renamingId]);

  function startRename(chat){setRenamingId(chat.id);setRenameVal(chat.title);}
  function commitRename(){
    if(renameVal.trim())setChatList(p=>p.map(c=>c.id===renamingId?{...c,title:renameVal.trim()}:c));
    setRenamingId(null);
  }
  function doDelete(){
    const remaining=chatList.filter(c=>c.id!==deleteTarget.id);
    setChatList(remaining);
    if(activeChat===deleteTarget.id&&remaining.length>0)setActiveChat(remaining[0].id);
    setDeleteTarget(null);
  }

  const navItems=[
    {id:"docs",Icon:DocIcon,label:"Documents"},
    {id:"memory",Icon:BrainIcon,label:"Memory"},
    {id:"settings",Icon:GearIcon,label:"Settings"},
  ];

  if(collapsed) return(
    <div style={{width:48,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 0",gap:4,flexShrink:0}}>
      <div onClick={()=>setCollapsed(false)} title="Expand" style={{width:26,height:26,borderRadius:5,background:`linear-gradient(135deg,${C.teal},${C.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:C.bg,fontWeight:700,fontFamily:MONO,cursor:"pointer",marginBottom:6}}>AI</div>
      <Btn onClick={()=>setCollapsed(false)} title="Expand sidebar"><ChevR size={14}/></Btn>
      <button title="New Chat" style={{width:28,height:28,background:"transparent",border:`1px solid rgba(78,201,176,0.35)`,borderRadius:4,color:C.teal,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",marginTop:4,marginBottom:8}}>+</button>
      <div style={{flex:1}}/>
      {navItems.map(({id,Icon,label})=>(
        <Btn key={id} title={label} active={rightPanel===id} onClick={()=>setRightPanel(p=>p===id?null:id)}><Icon size={16}/></Btn>
      ))}
    </div>
  );

  return(
    <>
      {deleteTarget&&<DeleteModal title={deleteTarget.title} onConfirm={doDelete} onCancel={()=>setDeleteTarget(null)}/>}
      <div style={{width:232,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,fontFamily:MONO}}>
        {/* Header */}
        <div style={{padding:"10px 12px 10px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:22,height:22,borderRadius:4,background:`linear-gradient(135deg,${C.teal},${C.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:C.bg,fontWeight:700,flexShrink:0}}>AI</div>
          <span style={{fontSize:12,color:C.textMid,fontWeight:600,letterSpacing:"0.06em",flex:1}}>ElectronAIChat</span>
          <button onClick={()=>setCollapsed(true)} title="Collapse sidebar" style={{background:"transparent",border:"none",cursor:"pointer",color:C.textFaint,padding:2,borderRadius:3,display:"flex",alignItems:"center"}}>
            <ChevL size={14}/>
          </button>
        </div>
        {/* Search */}
        <div style={{padding:"8px 10px 4px"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,background:C.input,borderRadius:4,padding:"5px 9px"}}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke={C.textLo} strokeWidth="1.5"/><path d="M11 11L15 15" stroke={C.textLo} strokeWidth="1.5" strokeLinecap="round"/></svg>
            <span style={{fontSize:11,color:C.textFaint}}>Search chats…</span>
          </div>
        </div>
        {/* New chat */}
        <div style={{padding:"4px 10px 6px"}}>
          <button style={{width:"100%",padding:"6px 10px",background:"transparent",border:`1px solid rgba(78,201,176,0.3)`,borderRadius:4,color:C.teal,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:MONO}}>
            <span style={{fontSize:14,lineHeight:1}}>+</span> New Chat
          </button>
        </div>
        <div style={{fontSize:10,color:C.textFaint,letterSpacing:"0.1em",textTransform:"uppercase",padding:"6px 14px 3px"}}>Recent</div>
        {/* List */}
        <div style={{flex:1,overflowY:"auto"}}>
          {chatList.map(chat=>{
            const isActive=activeChat===chat.id;
            const isHov=hovered===chat.id;
            const isRen=renamingId===chat.id;
            return(
              <div key={chat.id} onClick={()=>!isRen&&setActiveChat(chat.id)}
                onMouseEnter={()=>setHovered(chat.id)} onMouseLeave={()=>setHovered(null)}
                style={{padding:"7px 8px 7px 12px",cursor:isRen?"default":"pointer",
                  background:isActive?"rgba(78,201,176,0.07)":isHov?"rgba(255,255,255,0.03)":"transparent",
                  borderLeft:isActive?`2px solid ${C.teal}`:"2px solid transparent",
                  display:"flex",alignItems:"center",gap:4,transition:"background 0.1s"}}>
                <div style={{flex:1,minWidth:0}}>
                  {isRen?(
                    <input ref={inputRef} value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter")commitRename();if(e.key==="Escape")setRenamingId(null);}}
                      onClick={e=>e.stopPropagation()}
                      style={{width:"100%",background:C.input,border:`1px solid ${C.teal}`,borderRadius:3,padding:"2px 6px",color:C.textHi,fontSize:11,fontFamily:MONO,outline:"none"}}/>
                  ):(
                    <>
                      <div style={{fontSize:11,color:isActive?C.textHi:"#AAAAAA",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{chat.title}</div>
                      <div style={{fontSize:10,color:C.textFaint,marginTop:2}}>{chat.time}</div>
                    </>
                  )}
                </div>
                <div style={{display:"flex",gap:0,flexShrink:0,opacity:(isHov||isRen||isActive)?1:0,transition:"opacity 0.15s"}}>
                  {isRen?(
                    <>
                      <Btn active color={C.teal} title="Save" onClick={e=>{e.stopPropagation();commitRename();}}><CheckIcon/></Btn>
                      <Btn title="Cancel" onClick={e=>{e.stopPropagation();setRenamingId(null);}}><XIcon/></Btn>
                    </>
                  ):(
                    <>
                      <Btn title="Rename" onClick={e=>{e.stopPropagation();startRename(chat);}}><PencilIcon/></Btn>
                      <Btn danger title="Delete" onClick={e=>{e.stopPropagation();setDeleteTarget(chat);}}><TrashIcon/></Btn>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* Bottom nav */}
        <div style={{borderTop:`1px solid ${C.border}`,padding:"8px 10px",display:"flex",justifyContent:"space-around"}}>
          {navItems.map(({id,Icon,label})=>(
            <Btn key={id} title={label} active={rightPanel===id} onClick={()=>setRightPanel(p=>p===id?null:id)}><Icon size={16}/></Btn>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Message renderer ──
function Msg({msg}){
  const isUser=msg.role==="user";
  const parts=msg.content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return(
    <div style={{padding:"16px 24px",display:"flex",gap:14,background:isUser?"transparent":"rgba(255,255,255,0.018)",borderBottom:`1px solid ${C.divider}`}}>
      <div style={{width:26,height:26,borderRadius:4,flexShrink:0,marginTop:1,background:isUser?C.input:`linear-gradient(135deg,${C.teal},${C.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,fontFamily:MONO,color:isUser?C.textLo:C.bg}}>
        {isUser?"U":"AI"}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span style={{fontSize:11,fontFamily:MONO,fontWeight:600,letterSpacing:"0.03em",color:isUser?C.textMid:C.teal}}>{isUser?"user":"assistant"}</span>
          <span style={{fontSize:10,color:C.textFaint,fontFamily:MONO}}>{msg.time}</span>
          {msg.streaming&&<span style={{fontSize:10,color:C.yellow,fontFamily:MONO,display:"flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:"50%",background:C.yellow,display:"inline-block",animation:"pulse 1s infinite"}}/> streaming</span>}
        </div>
        <div style={{fontSize:13,color:"#D4D4D4",lineHeight:1.75,fontFamily:SANS}}>
          {parts.map((p,i)=>{
            if(p.startsWith("**")&&p.endsWith("**")) return <strong key={i} style={{color:C.textHi,fontWeight:600}}>{p.slice(2,-2)}</strong>;
            if(p.startsWith("`")&&p.endsWith("`")) return <code key={i} style={{fontFamily:MONO,fontSize:11,color:C.orange,background:"rgba(206,145,120,0.1)",padding:"1px 5px",borderRadius:3}}>{p.slice(1,-1)}</code>;
            return <span key={i}>{p}</span>;
          })}
          {msg.streaming&&<span style={{display:"inline-block",width:2,height:14,background:C.teal,marginLeft:2,verticalAlign:"text-bottom",animation:"blink 1s step-end infinite"}}/>}
        </div>
        {msg.sources?.length>0&&(
          <div style={{marginTop:10,display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:10,color:C.textFaint,fontFamily:MONO}}>sources:</span>
            {msg.sources.map(s=><span key={s} style={{fontSize:10,color:C.blue,fontFamily:MONO,background:"rgba(86,156,214,0.08)",border:"1px solid rgba(86,156,214,0.2)",borderRadius:3,padding:"2px 7px",cursor:"pointer"}}>{s}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat panel ──
function ChatPanel({chatTitle}){
  const [input,setInput]=useState("");
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
      <div style={{height:42,background:C.raised,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",padding:"0 16px",gap:10,flexShrink:0}}>
        <span style={{fontSize:12,color:C.textMid,fontFamily:MONO,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{chatTitle}</span>
        <Tag label="ALL" color={C.teal} bg="rgba(78,201,176,0.1)" border="rgba(78,201,176,0.25)"/>
        <Tag label="llama3.2:latest" color={C.blue} bg="rgba(86,156,214,0.1)" border="rgba(86,156,214,0.25)"/>
      </div>
      <div style={{flex:1,overflowY:"auto",background:C.bg}}>
        {MESSAGES.map(m=><Msg key={m.id} msg={m}/>)}
        <div style={{height:24}}/>
      </div>
      <div style={{background:C.surface,borderTop:`1px solid ${C.border}`,padding:"12px 16px",flexShrink:0}}>
        <div style={{display:"flex",gap:8,background:C.input,borderRadius:6,border:"1px solid rgba(255,255,255,0.08)",padding:"10px 12px",alignItems:"flex-end"}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask something…" rows={1}
            style={{flex:1,background:"transparent",border:"none",outline:"none",color:"#D4D4D4",fontSize:13,fontFamily:SANS,resize:"none",lineHeight:1.6}}/>
          <button style={{background:C.teal,border:"none",borderRadius:4,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,color:C.bg}}>
            <SendIcon/>
          </button>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:7,paddingLeft:2}}>
          <span style={{fontSize:10,color:C.textFaint,fontFamily:MONO}}>⏎ send · ⇧⏎ newline</span>
          <span style={{fontSize:10,color:C.textFaint,fontFamily:MONO}}>temp: 0.7 · max_tokens: 2048</span>
        </div>
      </div>
    </div>
  );
}

// ── Right panel shell ──
function RPanel({title,icon,children}){
  return(
    <div style={{width:260,background:C.surface,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
      <div style={{height:42,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:7,padding:"0 14px",flexShrink:0}}>
        <span style={{color:C.textLo}}>{icon}</span>
        <span style={{fontSize:11,color:C.textMid,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:MONO}}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Docs panel ──
function DocsPanel(){
  const [mode,setMode]=useState("ALL");
  return(
    <RPanel title="Documents" icon={<DocIcon size={13}/>}>
      <div style={{padding:"10px 14px 8px"}}>
        <div style={{fontSize:10,color:C.textFaint,fontFamily:MONO,letterSpacing:"0.08em",marginBottom:6}}>SEARCH MODE</div>
        <div style={{display:"flex",gap:4}}>
          {["LLM","RAG","ALL"].map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"5px 0",fontFamily:MONO,fontSize:10,cursor:"pointer",borderRadius:3,letterSpacing:"0.05em",background:mode===m?"rgba(78,201,176,0.12)":"transparent",border:mode===m?`1px solid ${C.teal}`:`1px solid ${C.input}`,color:mode===m?C.teal:C.textLo}}>{m}</button>
          ))}
        </div>
      </div>
      <div style={{height:1,background:C.divider}}/>
      {DOCS.map(d=>{
        const dot=d.status==="indexed"?C.teal:d.status==="indexing"?C.yellow:C.red;
        return(
          <div key={d.name} style={{padding:"9px 14px",borderBottom:`1px solid ${C.divider}`,cursor:"pointer"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:dot,flexShrink:0}}/>
              <span style={{fontSize:11,color:C.textMid,fontFamily:MONO,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.name}</span>
            </div>
            <div style={{fontSize:10,color:C.textFaint,fontFamily:MONO,paddingLeft:13,display:"flex",gap:10}}>
              <span>{d.size}</span>
              {d.status==="indexing"?<span style={{color:C.yellow}}>indexing…</span>:<span>{d.chunks} chunks</span>}
            </div>
          </div>
        );
      })}
      <div style={{padding:"10px 12px"}}>
        <div style={{border:"1px dashed rgba(255,255,255,0.12)",borderRadius:5,padding:"16px 10px",textAlign:"center",cursor:"pointer"}}>
          <div style={{fontSize:18,color:C.textFaint,marginBottom:4}}>↑</div>
          <div style={{fontSize:10,color:C.textFaint}}>Drop files or click to upload</div>
          <div style={{fontSize:10,color:C.textFaint,marginTop:2,opacity:0.6}}>PDF · TXT · MD · DOCX · JSON · PY</div>
        </div>
      </div>
    </RPanel>
  );
}

// ── Memory panel ──
function MemoryPanel(){
  const [search,setSearch]=useState("");
  const filtered=MEMORIES.filter(m=>m.text.toLowerCase().includes(search.toLowerCase()));
  return(
    <RPanel title="Memory" icon={<BrainIcon size={13}/>}>
      <div style={{display:"flex",borderBottom:`1px solid ${C.divider}`}}>
        {[{l:"facts",v:"24",c:C.teal},{l:"sessions",v:"12",c:C.blue},{l:"deduped",v:"9",c:C.yellow}].map((s,i,a)=>(
          <div key={s.l} style={{flex:1,padding:"10px 0",textAlign:"center",borderRight:i<a.length-1?`1px solid ${C.divider}`:"none"}}>
            <div style={{fontSize:16,fontFamily:MONO,fontWeight:600,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:C.textFaint,fontFamily:MONO,marginTop:1}}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{padding:"8px 12px"}}>
        <div style={{display:"flex",alignItems:"center",gap:6,background:C.input,borderRadius:4,padding:"5px 9px"}}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke={C.textLo} strokeWidth="1.5"/><path d="M11 11L15 15" stroke={C.textLo} strokeWidth="1.5" strokeLinecap="round"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search memories…"
            style={{background:"transparent",border:"none",outline:"none",color:C.textMid,fontSize:11,fontFamily:MONO,width:"100%"}}/>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {filtered.map(m=>{
          const tc=MEM_COLORS[m.tag];
          return(
            <div key={m.id} style={{padding:"9px 14px",borderBottom:`1px solid ${C.divider}`,display:"flex",flexDirection:"column",gap:5}}>
              <div style={{fontSize:11,color:C.textMid,lineHeight:1.55,fontFamily:SANS}}>{m.text}</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <Tag label={m.tag} color={tc.color} bg={tc.bg} border={tc.border}/>
                <span style={{fontSize:10,color:C.textFaint,fontFamily:MONO}}>{m.ts}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{padding:"10px 12px",borderTop:`1px solid ${C.divider}`,display:"flex",gap:6}}>
        <button style={{flex:1,padding:"6px 0",background:"transparent",border:`1px solid ${C.divider}`,borderRadius:4,color:C.textLo,fontSize:10,cursor:"pointer",fontFamily:MONO}}>Clear All</button>
        <button style={{flex:1,padding:"6px 0",background:"transparent",border:"1px solid rgba(78,201,176,0.3)",borderRadius:4,color:C.teal,fontSize:10,cursor:"pointer",fontFamily:MONO}}>Export</button>
      </div>
    </RPanel>
  );
}

// ── Settings panel ──
function SettingsPanel(){
  const [provider,setProvider]=useState("ollama");
  const [temp,setTemp]=useState(0.7);
  const [tokens,setTokens]=useState(2048);
  const [topP,setTopP]=useState(0.9);
  const [sysprompt,setSysprompt]=useState("You are a helpful AI assistant with access to documents and long-term memory.");
  const [memOn,setMemOn]=useState(true);
  const [theme,setTheme]=useState("dark");

  const Sec=({label,children})=>(
    <div style={{borderBottom:`1px solid ${C.divider}`}}>
      <div style={{fontSize:10,color:C.textFaint,fontFamily:MONO,letterSpacing:"0.1em",textTransform:"uppercase",padding:"10px 14px 6px"}}>{label}</div>
      <div style={{padding:"0 14px 12px",display:"flex",flexDirection:"column",gap:8}}>{children}</div>
    </div>
  );
  const SInput=({label,value,type="text"})=>(
    <div>
      <div style={{fontSize:10,color:C.textFaint,fontFamily:MONO,marginBottom:4}}>{label}</div>
      <input defaultValue={value} type={type} style={{width:"100%",background:C.input,border:"1px solid rgba(255,255,255,0.07)",borderRadius:4,padding:"6px 9px",color:C.textMid,fontSize:11,fontFamily:MONO,outline:"none"}}/>
    </div>
  );
  const Slider=({label,value,min,max,step,onChange,color})=>(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
        <span style={{fontSize:10,color:C.textFaint,fontFamily:MONO}}>{label}</span>
        <span style={{fontSize:10,color,fontFamily:MONO}}>{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(parseFloat(e.target.value))} style={{width:"100%",accentColor:color,cursor:"pointer"}}/>
    </div>
  );
  const Toggle=({label,enabled,onChange})=>(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <span style={{fontSize:11,color:C.textMid,fontFamily:SANS}}>{label}</span>
      <div onClick={()=>onChange?.(!enabled)} style={{width:34,height:18,borderRadius:9,cursor:"pointer",background:enabled?C.teal:C.input,position:"relative",transition:"background 0.2s",flexShrink:0}}>
        <div style={{position:"absolute",top:2,left:enabled?18:2,width:14,height:14,borderRadius:"50%",background:enabled?C.bg:C.textFaint,transition:"left 0.2s"}}/>
      </div>
    </div>
  );

  return(
    <RPanel title="Settings" icon={<GearIcon size={13}/>}>
      <div style={{flex:1,overflowY:"auto"}}>
        <Sec label="LLM Provider">
          <div style={{display:"flex",gap:4}}>
            {["ollama","openai","llamacpp"].map(p=>(
              <button key={p} onClick={()=>setProvider(p)} style={{flex:1,padding:"5px 0",fontFamily:MONO,fontSize:10,cursor:"pointer",borderRadius:3,background:provider===p?"rgba(86,156,214,0.12)":"transparent",border:provider===p?`1px solid ${C.blue}`:`1px solid ${C.input}`,color:provider===p?C.blue:C.textLo}}>{p}</button>
            ))}
          </div>
          {provider==="ollama"&&<SInput label="Host" value="http://localhost:11434"/>}
          {provider==="openai"&&<SInput label="API Key" value="sk-••••••••••••••••••••" type="password"/>}
          <SInput label="Model" value={provider==="openai"?"gpt-4o":provider==="llamacpp"?"qwen3-0.6b-q4.gguf":"llama3.2:latest"}/>
          <SInput label="Embed Model" value={provider==="openai"?"text-embedding-3-small":"nomic-embed-text"}/>
        </Sec>
        <Sec label="Generation">
          <Slider label="Temperature" value={temp} min={0} max={2} step={0.05} onChange={setTemp} color={C.teal}/>
          <Slider label="Max Tokens" value={tokens} min={256} max={8192} step={256} onChange={setTokens} color={C.blue}/>
          <Slider label="Top P" value={topP} min={0} max={1} step={0.05} onChange={setTopP} color={C.yellow}/>
        </Sec>
        <Sec label="System Prompt">
          <textarea value={sysprompt} onChange={e=>setSysprompt(e.target.value)} rows={4}
            style={{width:"100%",background:C.input,border:"1px solid rgba(255,255,255,0.08)",borderRadius:4,padding:"8px 10px",color:"#D4D4D4",fontSize:11,fontFamily:SANS,resize:"vertical",lineHeight:1.6,outline:"none"}}/>
        </Sec>
        <Sec label="Features">
          <Toggle label="Long-term Memory (Mem0)" enabled={memOn} onChange={setMemOn}/>
          <Toggle label="OCR Fallback (Tesseract)" enabled={true}/>
          <Toggle label="Auto-generate chat titles" enabled={true}/>
        </Sec>
        <Sec label="Appearance">
          <div style={{display:"flex",gap:4}}>
            {["dark","light"].map(t=>(
              <button key={t} onClick={()=>setTheme(t)} style={{flex:1,padding:"5px 0",fontFamily:MONO,fontSize:10,cursor:"pointer",borderRadius:3,background:theme===t?"rgba(78,201,176,0.12)":"transparent",border:theme===t?`1px solid ${C.teal}`:`1px solid ${C.input}`,color:theme===t?C.teal:C.textLo}}>{t}</button>
            ))}
          </div>
        </Sec>
      </div>
      <div style={{padding:"10px 14px",borderTop:`1px solid ${C.divider}`}}>
        <button style={{width:"100%",padding:"8px 0",background:C.teal,border:"none",borderRadius:4,color:C.bg,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:MONO,letterSpacing:"0.05em"}}>Save Settings</button>
      </div>
    </RPanel>
  );
}

// ── App ──
export default function App(){
  const [collapsed,setCollapsed]=useState(false);
  const [activeChat,setActiveChat]=useState(1);
  const [chatList,setChatList]=useState(INIT_CHATS);
  const [rightPanel,setRightPanel]=useState(null);
  const current=chatList.find(c=>c.id===activeChat);

  return(
    <div style={{display:"flex",height:"100vh",width:"100vw",background:C.bg,overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#3C3C3C;border-radius:3px}
        ::-webkit-scrollbar-thumb:hover{background:#4C4C4C}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
      `}</style>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed}
        activeChat={activeChat} setActiveChat={setActiveChat}
        chatList={chatList} setChatList={setChatList}
        rightPanel={rightPanel} setRightPanel={setRightPanel}/>
      <ChatPanel chatTitle={current?.title??"No chat selected"}/>
      {rightPanel==="docs"&&<DocsPanel/>}
      {rightPanel==="memory"&&<MemoryPanel/>}
      {rightPanel==="settings"&&<SettingsPanel/>}
    </div>
  );
}
