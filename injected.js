/**
 * Bubble Breakpoint Override v1.0.0
 * 3-Layer AI Responsive: Auto-fix → Claude → Visual Review
 */
(function() {
  'use strict';

  const LANG = {
    en: {
      title:'BBO',mode:'Mode',breakpoint:'BP',element:'Element',
      design:'Design',responsive:'Responsive',
      recording:'Recording',paused:'Paused',autoSave:'Auto-save',
      elements:'elements',changes:'changes',
      applied:'Applied',to:'to',undo:'Undo',
      noChanges:'No changes recorded',copyFrom:'Copy from',
      cleared:'Session cleared',undone:'All changes undone',lang:'ES',
      aiSelected:'AI Selected',aiFull:'AI Full Page',
      aiAnalyzing:'Analyzing...',aiSection:'Section',
      aiApply:'Apply all',aiCancel:'Cancel',aiPreview:'AI suggestions',
      aiNoEl:'Select an element first',
      aiKeySaved:'API key saved',aiError:'AI error',
      pvTitle:'Mobile Preview',pvClose:'Close',pvApply:'Apply changes',
      pvHide:'Hide element',pvShow:'Show element',pvReset:'Reset',
      autoFixing:'Auto-fixing obvious issues...',
      reviewing:'Reviewing screenshots...',
    },
    es: {
      title:'BBO',mode:'Modo',breakpoint:'BP',element:'Elemento',
      design:'Diseño',responsive:'Responsivo',
      recording:'Grabando',paused:'Pausado',autoSave:'Auto-guardar',
      elements:'elementos',changes:'cambios',
      applied:'Aplicados',to:'en',undo:'Deshacer',
      noChanges:'Sin cambios',copyFrom:'Copiar de',
      cleared:'Sesión limpia',undone:'Cambios deshechos',lang:'EN',
      aiSelected:'AI Selección',aiFull:'AI Página Completa',
      aiAnalyzing:'Analizando...',aiSection:'Sección',
      aiApply:'Aplicar todo',aiCancel:'Cancelar',aiPreview:'Sugerencias AI',
      aiNoEl:'Seleccioná un elemento',
      aiKeySaved:'API key guardada',aiError:'Error de AI',
      pvTitle:'Vista Previa Móvil',pvClose:'Cerrar',pvApply:'Aplicar cambios',
      pvHide:'Ocultar elemento',pvShow:'Mostrar elemento',pvReset:'Reset',
      autoFixing:'Auto-corrigiendo problemas obvios...',
      reviewing:'Revisando screenshots...',
    }
  };
  let lang=(navigator.language||'').startsWith('es')?'es':'en';
  const t=k=>LANG[lang][k]||LANG.en[k]||k;

  const BP={
    'built-in-desktop':{w:1200,l:'Desktop'},'default':{w:1080,l:'Default'},
    'built-in-tablet':{w:992,l:'Tablet'},'built-in-mobile-landing':{w:768,l:'Landscape'},
    'built-in-mobile':{w:320,l:'Mobile'},
  };
  const SKIP_TOP=new Set(['states','name','type','id','_id','parent','rank','version','workflows','events','conditions','children','data_source','content_type','placeholder','initial_content','default_value','custom_attributes','page_id','collapse_when_hidden','top','left','width','height','order','zindex','draggable','single_height','single_width','fit_height','fit_width','properties','text']);
  const SKIP_IN=new Set(['height','width','left','top','right','bottom','properties']);
  const GLOBAL=new Set(['built-in-desktop','default']);
  const log=(...a)=>console.log('%c[BBO]','color:#FF6B35;font-weight:bold',...a);
  const prettyKey=k=>k.replace(/_css$/,'').replace(/_/g,' ').replace(/\b[a-z]/g,c=>c.toUpperCase());
  const prettyVal=v=>v===true?'✓':v===false?'✗':v==null?'—':typeof v==='object'?JSON.stringify(v):String(v);

  // ====================== EDITOR API ======================
  const E={
    isResp:()=>!!document.querySelector('.tabcanvas.responsive-mode'),
    pageId(){try{return Lib().design_tab.get_root().id()}catch(e){return null}},
    pageRoot(){try{return Lib().design_tab.get_root()}catch(e){return null}},
    bp(){if(!this.isResp())return null;const b=document.querySelector('button.f4xyi61[data-breakpoint]');return b?b.getAttribute('data-breakpoint'):null},
    sel(){try{const ids=Lib().design_tab.current_editor_canvas.getSelected().filter(i=>!i.includes('layers'));return ids.length===1?appquery.by_id(ids[0]):null}catch(e){return null}},
    selId(){try{return this.sel()?.id()}catch(e){return null}},
    selRaw(){try{return this.sel()?.raw()}catch(e){return null}},
    elName(id){try{const r=appquery.by_id(id).raw();return r.name||r.type?.split?.('-')?.pop?.()||id}catch(e){return id}},
    getTree(id){
      try{
        const el=appquery.by_id(id);const raw=el.raw();
        const children=raw.elements||{};
        const kidsList=Object.values(children).sort((a,b)=>(a.properties?.order||0)-(b.properties?.order||0));
        const kids=kidsList.map(c=>c.id?this.getTree(c.id):null).filter(Boolean);
        let textContent=null;
        if(raw.properties?.text?.entries)textContent=Object.values(raw.properties.text.entries).join('');
        else if(raw.text?.entries)textContent=Object.values(raw.text.entries).join('');
        const p=raw.properties||{};const clean={};
        const keep=['font_size','font_family','font_weight','font_color','font_alignment','line_height','letter_spacing','word_spacing',
          'padding_top','padding_bottom','padding_left','padding_right','margin_top','margin_bottom','margin_left','margin_right',
          'min_width_css','min_height_css','fit_width','fit_height','single_width','single_height',
          'container_layout','horiz_alignment','vert_alignment','container_vert_alignment','container_horiz_alignment',
          'row_gap','column_gap','use_gap','background_style','bgcolor','border_roundness',
          'is_visible','bold','italic','tag_type'];
        for(const k of keep)if(p[k]!==undefined)clean[k]=p[k];
        return{id:raw.id||raw._id,name:raw.name||null,type:raw.type,text:textContent,props:clean,kids};
      }catch(e){return null}
    },
    getPageSections(){
      try{const root=this.pageRoot();if(!root)return[];const raw=root.raw();const ch=raw.elements||{};
        return Object.values(ch).filter(c=>c.id).sort((a,b)=>(a.properties?.order||0)-(b.properties?.order||0)).map(c=>({id:c.id,name:c.name||c.type?.split?.('-')?.pop?.()||c.id,type:c.type}));
      }catch(e){return[]}
    },
    getFullTree(){try{const root=this.pageRoot();if(!root)return null;return this.getTree(root.id())}catch(e){return null}},
    findBP(elId,bpId){try{const st=appquery.by_id(elId).raw().states||{};for(const[i,s]of Object.entries(st)){if(s.type!=='State'||s.condition?.type!=='PageData')continue;if(s.condition?.properties?.name!=='Current Page Width')continue;const a=s.condition?.next?.args;if(!a)continue;if(bpId==='default'&&a.type==='DefaultBreakpoint')return{i:+i,s};if(a.type==='Breakpoint'&&a.properties?.breakpoint_id===bpId)return{i:+i,s}}}catch(e){}return null},
    _cond(bpId,pid){const a=bpId==='default'?{type:"DefaultBreakpoint",is_slidable:false}:{type:"Breakpoint",properties:{breakpoint_id:bpId},next:null,is_slidable:false};return{type:"PageData",properties:{name:"Current Page Width",element_id:pid},next:{type:"Message",name:"less_or_equal_than",is_slidable:false,args:a},is_slidable:false}},
    setCond(elId,bpId,props){try{const el=appquery.by_id(elId);if(!el)return false;const pid=this.pageId();if(!pid)return false;const ex=this.findBP(elId,bpId);if(ex){Lib().undostack.commit();const st=el.states();for(const[k,v]of Object.entries(props))st[ex.i].set_property(k,v);Lib().undostack.commit();return true}const st=el.raw().states||{};const idx=Object.keys(st).length;const ns={type:"State",condition:this._cond(bpId,pid),properties:props};Lib().undostack.commit();let ok=false;if(!ok)try{Lib().changes.create_change('NewState',{element_id:elId,name:String(idx),data:ns}).execute();ok=true}catch(e){}if(!ok)try{Lib().changes.create_change('SetData',{path:'states.'+idx,target_id:elId,old_value:undefined,value:ns}).execute();ok=true}catch(e){}if(!ok)try{el.json.child('states').child(String(idx)).set(ns);ok=true}catch(e){}Lib().undostack.commit();return ok}catch(e){return false}},
    revertEl(elId,origRaw){try{const el=appquery.by_id(elId);if(!el||!origRaw)return;const cur=el.raw();const op=origRaw.properties||{},cp=cur.properties||{};Lib().undostack.commit();for(const k of Object.keys(cur)){if(SKIP_TOP.has(k))continue;if(JSON.stringify(cur[k])!==JSON.stringify(origRaw[k])){try{el.set_property(k,origRaw[k]!==undefined?origRaw[k]:null)}catch(e){}}}for(const k of Object.keys(cp)){if(SKIP_IN.has(k))continue;if(JSON.stringify(cp[k])!==JSON.stringify(op[k])){try{el.set_property(k,op[k]!==undefined?op[k]:null)}catch(e){}}}Lib().undostack.commit()}catch(e){log('Revert error:',e)}},
    diff(oldRaw){const raw=this.selRaw();if(!raw||!oldRaw)return null;const c={};for(const k of new Set([...Object.keys(oldRaw),...Object.keys(raw)])){if(SKIP_TOP.has(k))continue;if(JSON.stringify(oldRaw[k])!==JSON.stringify(raw[k])&&raw[k]!==undefined)c[k]=raw[k]}const op=oldRaw.properties||{},np=raw.properties||{};for(const k of new Set([...Object.keys(op),...Object.keys(np)])){if(SKIP_IN.has(k))continue;if(JSON.stringify(op[k])!==JSON.stringify(np[k])&&np[k]!==undefined)c[k]=np[k]}return Object.keys(c).length>0?c:null},
    diffRaw(oldRaw,newRaw){if(!newRaw||!oldRaw)return null;const c={};for(const k of new Set([...Object.keys(oldRaw),...Object.keys(newRaw)])){if(SKIP_TOP.has(k))continue;if(JSON.stringify(oldRaw[k])!==JSON.stringify(newRaw[k])&&newRaw[k]!==undefined)c[k]=newRaw[k]}const op=oldRaw.properties||{},np=newRaw.properties||{};for(const k of new Set([...Object.keys(op),...Object.keys(np)])){if(SKIP_IN.has(k))continue;if(JSON.stringify(op[k])!==JSON.stringify(np[k])&&np[k]!==undefined)c[k]=np[k]}return Object.keys(c).length>0?c:null}
  };

  // ====================== SESSION RECORDER ======================
  const R={
    active:false,wasResp:false,data:{},curElId:null,curBp:null,curSnap:null,undoTimer:null,undoData:null,
    snap(){const id=E.selId(),raw=E.selRaw();if(!id||!raw)return;this.curElId=id;this.curBp=E.bp();this.curSnap=JSON.parse(JSON.stringify(raw));if(!this.data[id])this.data[id]={name:raw.name||raw.type?.split?.('-')?.pop?.()||id,original:JSON.parse(JSON.stringify(raw)),breakpoints:{}}},
    tick(){if(!this.active)return;const resp=E.isResp(),id=E.selId(),bp=E.bp();if(resp&&!this.wasResp){this.wasResp=true;if(id)this.snap();return}if(!resp&&this.wasResp){this.wasResp=false;this._flush();this._applyAll();return}if(!resp)return;if(id!==this.curElId||bp!==this.curBp){this._flush();if(id)this.snap();return}if(!id||!this.curSnap||!bp||GLOBAL.has(bp))return;const diff=E.diff(this.curSnap);if(diff){if(!this.data[id])this.data[id]={name:E.elName(id),original:JSON.parse(JSON.stringify(this.curSnap)),breakpoints:{}};const ex=this.data[id].breakpoints[bp]||{};this.data[id].breakpoints[bp]={...ex,...diff};const raw=E.selRaw();if(raw)this.curSnap=JSON.parse(JSON.stringify(raw));UI.refresh()}},
    _flush(){if(!this.curElId||!this.curSnap||!this.curBp||GLOBAL.has(this.curBp))return;try{const curRaw=appquery.by_id(this.curElId).raw();const diff=E.diffRaw(this.curSnap,curRaw);if(diff&&this.data[this.curElId]){const ex=this.data[this.curElId].breakpoints[this.curBp]||{};this.data[this.curElId].breakpoints[this.curBp]={...ex,...diff}}}catch(e){}this.curElId=null;this.curBp=null;this.curSnap=null},
    _applyAll(){const entries=Object.entries(this.data);if(entries.length===0){UI.addLog(t('noChanges'),'i');return}let tc=0,te=0;this.undoData=JSON.parse(JSON.stringify(this.data));for(const[elId,rec]of entries){const bps=Object.entries(rec.breakpoints);if(bps.length===0)continue;te++;E.revertEl(elId,rec.original);for(const[bpId,props]of bps){const ok=E.setCond(elId,bpId,props);if(ok)tc+=Object.keys(props).length}}this.data={};UI.refresh();if(tc>0){UI.showUndo(tc,te);UI.addLog('✅ '+tc+' '+t('changes')+' → '+te+' '+t('elements'),'s')}},
    undo(){if(!this.undoData)return;for(const[elId,rec]of Object.entries(this.undoData))E.revertEl(elId,rec.original);this.undoData=null;if(this.undoTimer){clearTimeout(this.undoTimer);this.undoTimer=null}UI.hideUndo();UI.addLog(t('undone'),'i')},
    stats(){let e=0,c=0;for(const r of Object.values(this.data)){const b=Object.entries(r.breakpoints);if(b.length>0)e++;for(const[,p]of b)c+=Object.keys(p).length}return{els:e,changes:c}},
    editedElements(){return Object.entries(this.data).filter(([,r])=>Object.keys(r.breakpoints).length>0).map(([id,r])=>({id,name:r.name,breakpoints:r.breakpoints}))},
    copyFrom(srcId){const id=E.selId(),bp=E.bp();if(!id||!bp||GLOBAL.has(bp))return false;const src=this.data[srcId];if(!src)return false;if(!this.data[id]){const raw=E.selRaw();if(!raw)return false;this.data[id]={name:raw.name||id,original:JSON.parse(JSON.stringify(raw)),breakpoints:{}}}for(const[bpId,props]of Object.entries(src.breakpoints)){const ex=this.data[id].breakpoints[bpId]||{};this.data[id].breakpoints[bpId]={...ex,...props};try{const el=appquery.by_id(id);for(const[k,v]of Object.entries(props))try{el.set_property(k,v)}catch(e){}}catch(e){}}const raw=E.selRaw();if(raw)this.curSnap=JSON.parse(JSON.stringify(raw));UI.refresh();return true},
    clear(){this.data={};this.curElId=null;this.curBp=null;this.curSnap=null;UI.refresh()}
  };

  // ====================== LAYER 1: AUTO-FIX ======================
  const AF={
    run(tree, bpId){
      const w=BP[bpId]?.w||320;
      const fixes={};
      this._walk(tree, null, w, bpId, fixes);
      let count=0;
      for(const bps of Object.values(fixes))for(const props of Object.values(bps))count+=Object.keys(props).length;
      log('Auto-fix:',count,'fixes for',Object.keys(fixes).length,'elements at',w+'px');
      return fixes;
    },

    _addFix(fixes, id, bpId, prop, val){
      if(!fixes[id])fixes[id]={};
      if(!fixes[id][bpId])fixes[id][bpId]={};
      fixes[id][bpId][prop]=val;
    },

    _walk(node, parent, maxW, bpId, fixes){
      if(!node)return;
      const p=node.props||{};

      // 1. ROW GROUPS: children with fixed width that won't fit
      if(p.container_layout==='row'&&node.kids?.length>1){
        // Calculate total width of fixed-width children
        let totalFixed=0;let fixedKids=[];
        for(const kid of node.kids){
          const kp=kid.props||{};
          if(kp.single_width){
            // Fixed width element — uses its width directly
            const w=kp.min_width_css?parseInt(kp.min_width_css):200;
            totalFixed+=w;fixedKids.push(kid);
          } else if(kp.min_width_css&&kp.min_width_css.endsWith('px')){
            totalFixed+=parseInt(kp.min_width_css);
            if(parseInt(kp.min_width_css)>maxW)fixedKids.push(kid);
          }
        }
        // If children overflow, convert fixed-width children to flexible
        if(totalFixed>maxW&&fixedKids.length>0){
          for(const kid of fixedKids){
            const kp=kid.props||{};
            if(kp.single_width){
              // Remove fixed width → let it be flexible
              this._addFix(fixes,kid.id,bpId,'single_width',false);
              // Set min_width high enough to force wrap (one per row)
              this._addFix(fixes,kid.id,bpId,'min_width_css',Math.round(maxW*0.85)+'px');
            } else if(kp.min_width_css&&parseInt(kp.min_width_css)>maxW){
              this._addFix(fixes,kid.id,bpId,'min_width_css',Math.round(maxW*0.9)+'px');
            }
          }
        }
      }

      // 2. Font sizes — conservative
      if(p.font_size){
        const fs=p.font_size;
        if(maxW<=320){
          if(fs>=70)this._addFix(fixes,node.id,bpId,'font_size',Math.round(fs*0.42));
          else if(fs>=55)this._addFix(fixes,node.id,bpId,'font_size',Math.round(fs*0.5));
          else if(fs>=40)this._addFix(fixes,node.id,bpId,'font_size',Math.round(fs*0.6));
          else if(fs>=30)this._addFix(fixes,node.id,bpId,'font_size',Math.round(fs*0.7));
        }else if(maxW<=768){
          if(fs>=70)this._addFix(fixes,node.id,bpId,'font_size',Math.round(fs*0.55));
          else if(fs>=55)this._addFix(fixes,node.id,bpId,'font_size',Math.round(fs*0.65));
          else if(fs>=40)this._addFix(fixes,node.id,bpId,'font_size',Math.round(fs*0.75));
        }
      }

      // 3. Large paddings
      if(maxW<=320){
        if(p.padding_left>60)this._addFix(fixes,node.id,bpId,'padding_left',Math.round(p.padding_left*0.4));
        if(p.padding_right>60)this._addFix(fixes,node.id,bpId,'padding_right',Math.round(p.padding_right*0.4));
        if(p.padding_top>80)this._addFix(fixes,node.id,bpId,'padding_top',Math.round(p.padding_top*0.5));
        if(p.padding_bottom>80)this._addFix(fixes,node.id,bpId,'padding_bottom',Math.round(p.padding_bottom*0.5));
      }

      // 4. Letter/word spacing too negative
      if(p.letter_spacing&&p.letter_spacing<-4)this._addFix(fixes,node.id,bpId,'letter_spacing',Math.max(-2,Math.round(p.letter_spacing*0.5)));
      if(p.word_spacing&&p.word_spacing<-4)this._addFix(fixes,node.id,bpId,'word_spacing',Math.max(-2,Math.round(p.word_spacing*0.5)));

      // 5. Element's own fixed min_width > breakpoint
      if(p.min_width_css&&p.min_width_css.endsWith('px')&&!p.single_width){
        const px=parseInt(p.min_width_css);
        if(px>maxW)this._addFix(fixes,node.id,bpId,'min_width_css',Math.round(maxW*0.9)+'px');
      }

      // 6. Very large margins
      if(maxW<=320){
        if(p.margin_top>60)this._addFix(fixes,node.id,bpId,'margin_top',Math.round(p.margin_top*0.5));
        if(p.margin_bottom>60)this._addFix(fixes,node.id,bpId,'margin_bottom',Math.round(p.margin_bottom*0.5));
      }

      // Recurse
      if(node.kids)for(const kid of node.kids)this._walk(kid,node,maxW,bpId,fixes);
    }
  };






  // ====================== INTERACTIVE PREVIEW ======================
  const PV={
    overlay:null,edits:{},currentBp:'built-in-mobile',suggestions:null,tree:null,selId:null,showOriginal:false,

    treeToHTML(node,sug,bp){
      if(!node)return '';
      const p=node.props||{};
      const aiS=(sug&&sug[node.id]&&sug[node.id][bp])||{};
      const userE=this.edits[node.id]||{};
      const m=this.showOriginal?{...p}:{...p,...aiS,...userE};
      const st=[];const layout=p.container_layout;
      const isGroup=node.kids?.length>0||node.type?.includes?.('Group');
      if(isGroup){
        st.push('display:flex');
        if(layout==='row'){st.push('flex-direction:row','flex-wrap:wrap');const ha=m.horiz_alignment||m.container_horiz_alignment;if(ha==='center')st.push('justify-content:center');else if(ha==='space-between')st.push('justify-content:space-between')}
        else{st.push('flex-direction:column');const ha=m.horiz_alignment||m.container_horiz_alignment;if(ha==='center')st.push('align-items:center')}
        if(m.row_gap)st.push('row-gap:'+m.row_gap+'px');if(m.column_gap)st.push('column-gap:'+m.column_gap+'px');
      }
      if(m.single_width){const sw=m.min_width_css?parseInt(m.min_width_css):200;st.push('width:'+sw+'px','max-width:100%','flex-shrink:0','flex-grow:0')}
      else if(m.fit_width){st.push('width:fit-content','flex-shrink:1','flex-grow:0');if(m.min_width_css)st.push('min-width:'+m.min_width_css)}
      else{st.push('flex-grow:1','flex-shrink:1');if(m.min_width_css)st.push('min-width:'+m.min_width_css);else st.push('min-width:0')}
      if(m.padding_top)st.push('padding-top:'+m.padding_top+'px');if(m.padding_bottom)st.push('padding-bottom:'+m.padding_bottom+'px');
      if(m.padding_left)st.push('padding-left:'+m.padding_left+'px');if(m.padding_right)st.push('padding-right:'+m.padding_right+'px');
      if(m.margin_top)st.push('margin-top:'+m.margin_top+'px');if(m.margin_bottom)st.push('margin-bottom:'+m.margin_bottom+'px');
      if(m.font_size)st.push('font-size:'+m.font_size+'px');if(m.font_family)st.push("font-family:'"+m.font_family+"',sans-serif");
      if(m.font_weight)st.push('font-weight:'+m.font_weight);if(m.line_height)st.push('line-height:'+m.line_height);
      if(m.letter_spacing)st.push('letter-spacing:'+m.letter_spacing+'px');if(m.font_alignment)st.push('text-align:'+m.font_alignment);
      if(m.font_color&&!String(m.font_color).startsWith('var'))st.push('color:'+m.font_color);
      if(m.bold)st.push('font-weight:bold');
      if(m.bgcolor&&!String(m.bgcolor).startsWith('var'))st.push('background:'+m.bgcolor);
      if(m.border_roundness)st.push('border-radius:'+m.border_roundness+'px');
      if(m.is_visible===false)st.push('opacity:0.15');
      st.push('box-sizing:border-box','max-width:100%','overflow:hidden','position:relative','transition:outline 0.15s');
      const hasAI=!this.showOriginal&&Object.keys(aiS).length>0;
      const hasUser=!this.showOriginal&&Object.keys(userE).length>0;
      const isSel=node.id===this.selId;
      if(isSel)st.push('outline:3px solid #FF6B35');
      else if(hasUser)st.push('outline:2px solid rgba(255,107,53,0.6)');
      else if(hasAI)st.push('outline:1px dashed rgba(108,92,231,0.4)');
      let label='';
      if((hasAI||hasUser||isSel)&&!this.showOriginal){
        const name=node.name||node.type||'';
        const bg=isSel?'#FF6B35':hasUser?'rgba(255,107,53,0.8)':'rgba(108,92,231,0.7)';
        label='<div style="position:absolute;top:-1px;left:-1px;background:'+bg+';color:white;font-size:8px;font-weight:600;padding:1px 5px;border-radius:0 0 4px 0;z-index:9;font-family:sans-serif;line-height:1.4;pointer-events:none">'+name+'</div>';
      }
      let inner='';
      if(node.text)inner=node.text.replace(/\[color=[^\]]*\]/g,'').replace(/\[\/color\]/g,'').replace(/\\n/g,'<br>');
      if(node.type==='Image'||node.type?.includes?.('Image'))inner='<div style="background:#E8E8E8;width:100%;min-height:30px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#BBB">IMG</div>';
      if(node.type==='Button'){const tx=(node.text||'Button').replace(/\[.*?\]/g,'');inner='<div style="background:#333;color:white;padding:8px 16px;border-radius:'+(m.border_roundness||8)+'px;font-size:'+(m.font_size||14)+'px;text-align:center">'+tx+'</div>'}
      if(node.type==='Icon')inner='<div style="width:20px;height:20px;background:#DDD;border-radius:4px"></div>';
      const kids=node.kids?node.kids.map(k=>this.treeToHTML(k,sug,bp)).join(''):'';
      return '<div data-bbo-id="'+node.id+'" style="'+st.join(';')+';cursor:pointer" class="bbo-el">'+label+inner+kids+'</div>';
    },

    _findNode(tree,id){if(!tree)return null;if(tree.id===id)return tree;if(tree.kids)for(const k of tree.kids){const f=this._findNode(k,id);if(f)return f}return null},

    _buildEditor(elId){
      const node=this._findNode(this.tree,elId);if(!node)return '';
      const p=node.props||{};const aiS=(this.suggestions&&this.suggestions[elId]&&this.suggestions[elId][this.currentBp])||{};const userE=this.edits[elId]||{};const m={...p,...aiS,...userE};
      const name=node.name||node.type||elId;const isHidden=m.is_visible===false;
      const isSingleW=m.single_width;

      let html='<div class="bbo-ed-name">'+name+'</div>';
      html+='<div class="bbo-ed-type">'+node.type+(node.text?' — "'+node.text.slice(0,20)+'"':'')+'</div>';

      // Changes summary
      const aiKeys=Object.keys(aiS);const userKeys=Object.keys(userE);
      if(aiKeys.length>0||userKeys.length>0){
        html+='<div class="bbo-ed-changes">';
        if(aiKeys.length>0)html+='<span class="bbo-ed-chip ai">AI: '+aiKeys.map(k=>k+'='+aiS[k]).join(', ')+'</span>';
        if(userKeys.length>0)html+='<span class="bbo-ed-chip user">You: '+userKeys.map(k=>k+'='+userE[k]).join(', ')+'</span>';
        html+='</div>';
      }

      // Layout toggles
      html+='<div class="bbo-ed-section">Layout</div>';
      html+='<div class="bbo-ed-toggles">';
      html+='<button class="bbo-ed-toggle'+(isSingleW?' active':'')+'" data-action="toggle-single-width">'+(isSingleW?'🔒 Fixed W':'↔ Flexible')+'</button>';
      html+='<button class="bbo-ed-toggle'+(isHidden?' active':'')+'" data-action="toggle-vis">'+(isHidden?'👁 Show':'🚫 Hide')+'</button>';
      html+='</div>';

      // Size
      html+='<div class="bbo-ed-section">Size</div>';
      html+='<div class="bbo-ed-row"><label>Min W</label><input type="text" value="'+(m.min_width_css||'')+'" data-prop="min_width_css" class="bbo-ed-text" placeholder="e.g. 272px"></div>';

      // Typography
      if(p.font_size||aiS.font_size||m.font_size){
        html+='<div class="bbo-ed-section">Typography</div>';
        html+='<div class="bbo-ed-row"><label>Font</label><input type="range" min="8" max="80" value="'+(m.font_size||16)+'" data-prop="font_size" class="bbo-ed-slider"><span class="bbo-ed-val">'+(m.font_size||16)+'px</span></div>';
        if(m.letter_spacing!==undefined)html+='<div class="bbo-ed-row"><label>Ltr Sp</label><input type="range" min="-10" max="10" value="'+(m.letter_spacing||0)+'" data-prop="letter_spacing" class="bbo-ed-slider"><span class="bbo-ed-val">'+(m.letter_spacing||0)+'px</span></div>';
        if(m.line_height)html+='<div class="bbo-ed-row"><label>Line H</label><input type="range" min="0.8" max="3" step="0.1" value="'+(m.line_height||1.4)+'" data-prop="line_height" class="bbo-ed-slider"><span class="bbo-ed-val">'+(m.line_height||1.4)+'</span></div>';
      }

      // Spacing
      const hasSp=m.padding_top||m.padding_bottom||m.padding_left||m.padding_right||m.margin_top||m.margin_bottom||aiS.padding_top||aiS.padding_left;
      if(hasSp){
        html+='<div class="bbo-ed-section">Spacing</div>';
        const sp=[{k:'padding_top',l:'Pad T'},{k:'padding_bottom',l:'Pad B'},{k:'padding_left',l:'Pad L'},{k:'padding_right',l:'Pad R'},{k:'margin_top',l:'Mar T'},{k:'margin_bottom',l:'Mar B'}];
        for(const s of sp){if(m[s.k]!==undefined||aiS[s.k]!==undefined)html+='<div class="bbo-ed-row"><label>'+s.l+'</label><input type="range" min="0" max="120" value="'+(m[s.k]||0)+'" data-prop="'+s.k+'" class="bbo-ed-slider"><span class="bbo-ed-val">'+(m[s.k]||0)+'px</span></div>'}
      }

      // Gaps
      if(p.container_layout==='row'||p.container_layout==='column'){
        html+='<div class="bbo-ed-section">Gaps</div>';
        html+='<div class="bbo-ed-row"><label>Row</label><input type="range" min="0" max="40" value="'+(m.row_gap||0)+'" data-prop="row_gap" class="bbo-ed-slider"><span class="bbo-ed-val">'+(m.row_gap||0)+'px</span></div>';
        if(p.container_layout==='row')html+='<div class="bbo-ed-row"><label>Col</label><input type="range" min="0" max="40" value="'+(m.column_gap||0)+'" data-prop="column_gap" class="bbo-ed-slider"><span class="bbo-ed-val">'+(m.column_gap||0)+'px</span></div>';
      }

      // AI chat
      html+='<div class="bbo-ed-section">Ask AI about this element</div>';
      html+='<div class="bbo-ed-ai-row"><input type="text" class="bbo-ed-ai-input" id="bbo-ai-input" placeholder="e.g. achicá, stackeá cards..."><button class="bbo-ed-ai-btn" id="bbo-ai-ask">🤖</button></div>';

      // Reset
      html+='<div class="bbo-ed-actions"><button class="bbo-ed-reset" data-action="reset">↩ Reset element</button></div>';
      return html;
    },

    show(tree,suggestions,bpId){
      this.close();this.tree=tree;this.suggestions=suggestions;this.currentBp=bpId||'built-in-mobile';this.selId=null;this.showOriginal=false;
      const w=BP[this.currentBp]?.w||320;
      const overlay=document.createElement('div');overlay.id='bbo-preview-overlay';
      overlay.innerHTML=`<style>
#bbo-pv-wrap{position:fixed;top:0;left:0;right:0;bottom:0;z-index:999998;background:rgba(15,15,30,0.7);display:flex;font-family:'DM Sans',-apple-system,sans-serif}
#bbo-pv-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0}
#bbo-pv-hdr{width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:rgba(255,255,255,0.97);border-bottom:1px solid #EEE;flex-shrink:0;flex-wrap:wrap;gap:8px}
#bbo-pv-scroll{flex:1;overflow-y:auto;padding:20px;display:flex;justify-content:center;align-items:flex-start;background:#16162a;min-height:0}
#bbo-pv-phone{width:${w+2}px;background:white;border:2px solid #444;border-radius:24px;overflow:hidden;box-shadow:0 16px 50px rgba(0,0,0,0.5);margin-bottom:40px;position:relative}
#bbo-pv-notch{width:100px;height:6px;background:#444;border-radius:0 0 10px 10px;margin:0 auto}
#bbo-pv-content{width:${w}px;overflow-x:hidden;padding:1px}
#bbo-pv-editor{width:300px;background:#FAFAFA;border-left:1px solid #EEE;overflow-y:auto;flex-shrink:0;display:flex;flex-direction:column}
#bbo-pv-editor:empty{width:0;padding:0;border:0}
.bbo-ed-empty{padding:30px 20px;color:#AAA;font-size:11px;text-align:center;line-height:1.6}
.bbo-ed-name{font-size:13px;font-weight:700;color:#333;padding:16px 16px 2px}
.bbo-ed-type{font-size:9px;color:#AAA;padding:0 16px 8px}
.bbo-ed-changes{padding:4px 16px 8px;border-bottom:1px solid #F0F0F0}
.bbo-ed-chip{display:inline-block;font-size:8px;padding:2px 6px;border-radius:4px;margin-right:4px;margin-bottom:3px;word-break:break-all}
.bbo-ed-chip.ai{background:#EDE9FE;color:#6C5CE7}
.bbo-ed-chip.user{background:#FFF3EE;color:#FF6B35}
.bbo-ed-section{font-size:8px;font-weight:700;color:#AAA;text-transform:uppercase;letter-spacing:0.5px;padding:12px 16px 4px}
.bbo-ed-toggles{display:flex;gap:6px;padding:4px 16px 8px}
.bbo-ed-toggle{padding:5px 10px;border:1px solid #DDD;border-radius:6px;font-size:9px;cursor:pointer;font-family:inherit;background:white;color:#666;flex:1;text-align:center;transition:all .15s}
.bbo-ed-toggle:hover{border-color:#6C5CE7;color:#6C5CE7}
.bbo-ed-toggle.active{background:#6C5CE7;color:white;border-color:#6C5CE7}
.bbo-ed-row{display:flex;align-items:center;gap:6px;padding:4px 16px}
.bbo-ed-row label{font-size:9px;color:#888;width:44px;flex-shrink:0}
.bbo-ed-slider{flex:1;height:4px;-webkit-appearance:none;background:#E0E0E0;border-radius:4px;outline:none;cursor:pointer}
.bbo-ed-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;background:#6C5CE7;border-radius:50%;cursor:pointer}
.bbo-ed-val{font-size:9px;color:#6C5CE7;font-weight:600;min-width:36px;text-align:right}
.bbo-ed-text{flex:1;padding:4px 8px;border:1px solid #DDD;border-radius:5px;font-size:10px;font-family:inherit;outline:none}
.bbo-ed-text:focus{border-color:#6C5CE7}
.bbo-ed-ai-row{display:flex;gap:4px;padding:4px 16px 12px}
.bbo-ed-ai-input{flex:1;padding:6px 10px;border:1px solid #DDD;border-radius:6px;font-size:10px;font-family:inherit;outline:none}
.bbo-ed-ai-input:focus{border-color:#6C5CE7}
.bbo-ed-ai-btn{width:32px;border:none;border-radius:6px;background:#6C5CE7;color:white;font-size:12px;cursor:pointer}
.bbo-ed-ai-btn:hover{background:#5b4bd5}
.bbo-ed-actions{padding:8px 16px 16px;border-top:1px solid #F0F0F0;margin-top:auto}
.bbo-ed-reset{width:100%;padding:6px;border:1px solid #E0E0E0;border-radius:6px;font-size:9px;cursor:pointer;font-family:inherit;background:white;color:#AAA;text-align:center}
.bbo-ed-reset:hover{border-color:#FF6B35;color:#FF6B35}
.bbo-el:hover{outline:2px solid rgba(255,107,53,0.3)!important}
.bbo-pv-btn{padding:6px 14px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;border:1px solid #DDD;background:white;color:#666;transition:all .15s}
.bbo-pv-btn:hover{background:#F5F5F5}
.bbo-pv-apply{background:#6C5CE7!important;color:white!important;border-color:#6C5CE7!important}
.bbo-pv-apply:hover{background:#5b4bd5!important}
.bbo-pv-toggle{font-size:10px;padding:4px 10px}
.bbo-pv-toggle.active{background:#FF6B35!important;color:white!important;border-color:#FF6B35!important}
</style><div id="bbo-pv-wrap"><div id="bbo-pv-main">
<div id="bbo-pv-hdr"><div style="display:flex;align-items:center;gap:10px"><span style="font-size:14px;font-weight:700">${t('pvTitle')}</span><span style="font-size:11px;color:#999;background:#F0F0F0;padding:3px 10px;border-radius:4px" id="bbo-pv-bp-label">${w}px</span>
<select id="bbo-pv-bp-sel" style="font-size:11px;padding:4px 8px;border:1px solid #DDD;border-radius:5px;font-family:inherit"><option value="built-in-mobile" ${this.currentBp==='built-in-mobile'?'selected':''}>320px Mobile</option><option value="built-in-mobile-landing" ${this.currentBp==='built-in-mobile-landing'?'selected':''}>768px Tablet</option></select>
<button class="bbo-pv-btn bbo-pv-toggle" id="bbo-pv-compare">Original</button></div>
<div style="display:flex;gap:8px"><button class="bbo-pv-btn bbo-pv-apply" id="bbo-pv-apply">${t('pvApply')}</button><button class="bbo-pv-btn" id="bbo-pv-close">${t('pvClose')}</button></div></div>
<div id="bbo-pv-scroll"><div id="bbo-pv-phone"><div id="bbo-pv-notch"></div><div id="bbo-pv-content"></div></div></div></div>
<div id="bbo-pv-editor"><div class="bbo-ed-empty">👈 Click any element to edit it<br><br><span style="display:inline-block;width:8px;height:8px;background:#6C5CE7;border-radius:2px;margin-right:4px"></span>Purple = AI suggestion<br><span style="display:inline-block;width:8px;height:8px;background:#FF6B35;border-radius:2px;margin-right:4px"></span>Orange = your edit<br><br>Use the 🤖 Ask AI input to<br>modify any element with words</div></div></div>`;
      document.body.appendChild(overlay);this.overlay=overlay;this._render();this._bind();
    },

    _render(){
      if(!this.overlay)return;const w=BP[this.currentBp]?.w||320;
      const content=document.getElementById('bbo-pv-content');const phone=document.getElementById('bbo-pv-phone');
      if(content){
        // Wrap tree in a forced full-width column to simulate the page container
        const html=this.treeToHTML(this.tree,this._merged(),this.currentBp);
        content.innerHTML='<div style="width:'+w+'px;display:flex;flex-direction:column;overflow:hidden">'+html+'</div>';
        content.style.width=w+'px';
      }
      if(phone)phone.style.width=(w+2)+'px';
      const lbl=document.getElementById('bbo-pv-bp-label');if(lbl)lbl.textContent=w+'px';
      // Click handlers on ALL .bbo-el elements
      if(content)content.querySelectorAll('.bbo-el').forEach(el=>{el.addEventListener('click',e=>{e.stopPropagation();this.selId=el.getAttribute('data-bbo-id');this._render();this._showEditor(this.selId)})});
      const cmp=document.getElementById('bbo-pv-compare');
      if(cmp){cmp.classList.toggle('active',this.showOriginal);cmp.textContent=this.showOriginal?'✨ Show changes':'👁 Original'}
    },

    _merged(){
      if(!this.suggestions)return{};
      const m=JSON.parse(JSON.stringify(this.suggestions));
      for(const[id,props]of Object.entries(this.edits)){
        if(!m[id])m[id]={};
        if(!m[id][this.currentBp])m[id][this.currentBp]={};
        Object.assign(m[id][this.currentBp],props);
      }
      return m;
    },

    _showEditor(elId){
      const ed=document.getElementById('bbo-pv-editor');if(!ed)return;
      ed.innerHTML=this._buildEditor(elId);
      // Slider events
      ed.querySelectorAll('.bbo-ed-slider').forEach(s=>{
        s.addEventListener('input',e=>{
          const prop=e.target.getAttribute('data-prop');
          const val=parseFloat(e.target.value);
          const sp=e.target.parentElement.querySelector('.bbo-ed-val');
          if(sp)sp.textContent=val+(prop==='line_height'?'':'px');
          if(!this.edits[elId])this.edits[elId]={};
          this.edits[elId][prop]=val;
          this._render();this._showEditor(elId);
        });
      });
      // Text input events
      ed.querySelectorAll('.bbo-ed-text').forEach(i=>{
        i.addEventListener('change',e=>{
          const prop=e.target.getAttribute('data-prop');
          if(!this.edits[elId])this.edits[elId]={};
          this.edits[elId][prop]=e.target.value.trim();
          this._render();
        });
      });
      // Toggle fixed width
      ed.querySelector('[data-action="toggle-single-width"]')?.addEventListener('click',()=>{
        if(!this.edits[elId])this.edits[elId]={};
        const node=this._findNode(this.tree,elId);const p=node?.props||{};
        const aiS=(this.suggestions&&this.suggestions[elId]&&this.suggestions[elId][this.currentBp])||{};
        const cur={...p,...aiS,...this.edits[elId]};
        this.edits[elId].single_width=!cur.single_width;
        if(!cur.single_width&&!this.edits[elId].min_width_css){
          const bpW=BP[this.currentBp]?.w||320;
          this.edits[elId].min_width_css=Math.round(bpW*0.85)+'px';
        }
        this._render();this._showEditor(elId);
      });
      // Toggle visibility
      ed.querySelector('[data-action="toggle-vis"]')?.addEventListener('click',()=>{
        if(!this.edits[elId])this.edits[elId]={};
        const node=this._findNode(this.tree,elId);const p=node?.props||{};
        const aiS=(this.suggestions&&this.suggestions[elId]&&this.suggestions[elId][this.currentBp])||{};
        const cur={...p,...aiS,...this.edits[elId]};
        this.edits[elId].is_visible=cur.is_visible===false?true:false;
        this._render();this._showEditor(elId);
      });
      // Reset
      ed.querySelector('[data-action="reset"]')?.addEventListener('click',()=>{
        delete this.edits[elId];this._render();this._showEditor(elId);
      });
      // AI ask
      document.getElementById('bbo-ai-ask')?.addEventListener('click',()=>this._askAI(elId));
      document.getElementById('bbo-ai-input')?.addEventListener('keydown',e=>{if(e.key==='Enter')this._askAI(elId)});
    },

    async _askAI(elId){
      const input=document.getElementById('bbo-ai-input');
      if(!input||!input.value.trim()||!AI.apiKey)return;
      const instruction=input.value.trim();input.value='';input.placeholder='🤖 Thinking...';
      const node=this._findNode(this.tree,elId);if(!node)return;
      const bpW=BP[this.currentBp]?.w||320;
      try{
        const resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',
          headers:{'Content-Type':'application/json','x-api-key':AI.apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
          body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,messages:[{role:'user',content:`Bubble.io element "${node.name||node.type}" (${node.type}) at ${bpW}px breakpoint.
Current props: ${JSON.stringify(node.props)}
Current overrides: ${JSON.stringify({...(this.suggestions[elId]&&this.suggestions[elId][this.currentBp])||{},...this.edits[elId]||{}})}
${node.kids?.length?'Children: '+node.kids.map(k=>k.name||k.type).join(', '):''}
User says: "${instruction}"
Available props: font_size, padding_top/bottom/left/right, margin_top/bottom/left/right, min_width_css (px value like "272px"), single_width (bool), fit_width (bool), is_visible (bool), letter_spacing, line_height, row_gap, column_gap, horiz_alignment
RESPOND with ONLY JSON: {"prop":value}`}]})
        });
        if(!resp.ok)throw new Error('API '+resp.status);
        const data=await resp.json();const text=data.content?.find(c=>c.type==='text')?.text||'';
        const clean=text.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
        const match=clean.match(/\{[\s\S]*\}/);
        if(match){
          const props=JSON.parse(match[0]);
          if(!this.edits[elId])this.edits[elId]={};
          Object.assign(this.edits[elId],props);
          this._render();this._showEditor(elId);
          if(document.getElementById('bbo-ai-input'))document.getElementById('bbo-ai-input').placeholder='✅ Done! Ask more...';
        }
      }catch(e){
        if(document.getElementById('bbo-ai-input'))document.getElementById('bbo-ai-input').placeholder='❌ Error. Try again...';
      }
    },

    _bind(){
      document.getElementById('bbo-pv-close')?.addEventListener('click',()=>this.close());
      document.getElementById('bbo-pv-apply')?.addEventListener('click',()=>{
        // Merge user edits into suggestions
        for(const[id,props]of Object.entries(this.edits)){
          if(!this.suggestions[id])this.suggestions[id]={};
          if(!this.suggestions[id][this.currentBp])this.suggestions[id][this.currentBp]={};
          Object.assign(this.suggestions[id][this.currentBp],props);
        }
        this.edits={};AI.pending.suggestions=this.suggestions;AI.apply();
      });
      document.getElementById('bbo-pv-bp-sel')?.addEventListener('change',e=>{this.currentBp=e.target.value;this._render()});
      document.getElementById('bbo-pv-compare')?.addEventListener('click',()=>{this.showOriginal=!this.showOriginal;this._render()});
      document.getElementById('bbo-pv-wrap')?.addEventListener('click',e=>{if(e.target.id==='bbo-pv-wrap')this.close()});
    },

    close(){if(this.overlay){this.overlay.remove();this.overlay=null}this.edits={};this.selId=null;this.showOriginal=false}
  };

  // ====================== LAYER 2: AI MODULE ======================
  const AI={
    apiKey:null,pending:null,busy:false,aborted:false,
    screenshotServer:null,
    async loadKey(){
      try{const r=await chrome.storage?.local?.get?.(['bbo_api_key','bbo_screenshot_server']);
        if(r?.bbo_api_key)this.apiKey=r.bbo_api_key;
        if(r?.bbo_screenshot_server)this.screenshotServer=r.bbo_screenshot_server;
      }catch(e){try{this.apiKey=localStorage.getItem('bbo_api_key');this.screenshotServer=localStorage.getItem('bbo_screenshot_server')}catch(e2){}}
    },
    async saveKey(key){this.apiKey=key;try{await chrome.storage?.local?.set?.({bbo_api_key:key})}catch(e){try{localStorage.setItem('bbo_api_key',key)}catch(e2){}}},
    async saveScreenshotServer(url){this.screenshotServer=url;try{await chrome.storage?.local?.set?.({bbo_screenshot_server:url})}catch(e){try{localStorage.setItem('bbo_screenshot_server',url)}catch(e2){}}},

    // ─── SCREENSHOT SERVICE ───
    _getPreviewURL(){
      // Extract the Bubble app preview URL from the editor
      try{
        const href=window.location.href;
        // Editor URL: https://bubble.io/page?id=xxx&name=landing&...
        const m=href.match(/[?&]id=([^&]+)/);
        const nameM=href.match(/[?&]name=([^&]+)/);
        if(m){
          // Construct preview URL
          const appId=m[1];
          const pageName=nameM?nameM[1]:'index';
          // Try to get the app slug from the page
          const slugEl=document.querySelector('[data-app-slug]');
          const slug=slugEl?.getAttribute('data-app-slug');
          if(slug)return `https://${slug}.bubbleapps.io/version-test/${pageName}`;
          // Fallback: try to extract from editor URL patterns
          const appMatch=href.match(/bubble\.io\/page\?.*?&tab=/);
          // Try getting it from the preview button
          const prevBtn=document.querySelector('a[href*="version-test"]');
          if(prevBtn)return prevBtn.href;
        }
      }catch(e){}
      return null;
    },

    async _captureScreenshots(viewports=[320,768]){
      if(!this.screenshotServer){
        UI.addLog('⚠ No screenshot server configured','e');
        return null;
      }
      const url=this._getPreviewURL();
      if(!url){
        UI.addLog('⚠ Could not detect Bubble preview URL','e');
        // Prompt user to enter it
        const manual=prompt('Enter your Bubble page preview URL (e.g. https://yourapp.bubbleapps.io/version-test/landing):');
        if(!manual)return null;
        return this._fetchScreenshots(manual,viewports);
      }
      return this._fetchScreenshots(url,viewports);
    },

    async _fetchScreenshots(pageURL,viewports){
      UI.addLog('📸 Capturing screenshots at '+viewports.join(',')+' px...','i');
      console.log('📸 Calling screenshot server:',this.screenshotServer,'URL:',pageURL);
      try{
        const resp=await fetch(this.screenshotServer+'/screenshot',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({url:pageURL,viewports,fullPage:true,sections:true,waitFor:4000})
        });
        if(!resp.ok){const err=await resp.text();throw new Error('Screenshot server: '+resp.status+' '+err.slice(0,100))}
        const data=await resp.json();
        UI.addLog('📸 Got '+data.screenshots.map(s=>s.viewport+'px: '+s.images.length+' sections').join(', '),'s');
        console.log('📸 Screenshots received:',data.screenshots.map(s=>({viewport:s.viewport,chunks:s.chunks,totalHeight:s.totalHeight})));
        return data.screenshots;
      }catch(e){
        UI.addLog('❌ Screenshot failed: '+e.message.slice(0,60),'e');
        console.error('Screenshot error:',e);
        return null;
      }
    },

    // ─── VISION ANALYSIS: Claude reviews real screenshots ───
    async _callClaudeVision(screenshots,tree,existingChanges){
      const content=[];
      // Add each screenshot section as an image
      for(const vp of screenshots){
        for(let i=0;i<vp.images.length;i++){
          const imgData=vp.images[i].replace(/^data:image\/\w+;base64,/,'');
          content.push({type:'image',source:{type:'base64',media_type:'image/png',data:imgData}});
          content.push({type:'text',text:`↑ ${vp.viewport}px viewport — section ${i+1}/${vp.images.length}`});
        }
      }
      // Add the analysis prompt
      content.push({type:'text',text:this._buildVisionPrompt(tree,existingChanges)});

      for(let attempt=0;attempt<3;attempt++){
        const resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',
          headers:{'Content-Type':'application/json','x-api-key':this.apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
          body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:8000,messages:[{role:'user',content}]})
        });
        if(resp.status===429){const w=(attempt+1)*15000;UI.addLog('⏳ Vision rate limit, '+w/1000+'s...','i');await new Promise(r=>setTimeout(r,w));continue}
        if(!resp.ok){const err=await resp.text();throw new Error('Vision API '+resp.status+': '+err.slice(0,100))}
        const data=await resp.json();const text=data.content?.find(c=>c.type==='text')?.text||'';
        const clean=text.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
        try{
          const parsed=JSON.parse(clean);
          return parsed.changes||parsed;
        }catch(e){
          console.error('Vision parse error:',text.slice(0,200));
          return {};
        }
      }
      return {};
    },

    _buildVisionPrompt(tree,existingChanges){
      const changesSummary=existingChanges&&Object.keys(existingChanges).length>0?
        '\n\nCHANGES ALREADY GENERATED (from text analysis):\n'+
        Object.entries(existingChanges).slice(0,40).map(([id,bps])=>{
          const name=E.elName(id)||id;
          return name+': '+Object.entries(bps).map(([bp,p])=>
            bp.replace('built-in-mobile-landing','768').replace('built-in-mobile','320')+'→'+
            Object.entries(p).map(([k,v])=>k+'='+v).join(',')
          ).join(' | ');
        }).join('\n')
        :'';

      return `You are reviewing REAL screenshots of a Bubble.io page at mobile/tablet viewports. These are actual browser renders, not simulations.

LOOK FOR THESE PROBLEMS:
1. TEXT OVERFLOW — text too large, cut off, or extending beyond its container
2. ELEMENT OVERFLOW — elements wider than the viewport (horizontal scroll)
3. OVERLAPPING — elements stacking on top of each other incorrectly
4. TINY/UNREADABLE TEXT — text too small to read on mobile
5. BROKEN LAYOUT — cards/features not stacking properly, columns still side-by-side when they should stack
6. EXCESSIVE WHITESPACE — huge empty gaps that waste mobile screen space
7. HIDDEN CONTENT — important content not visible that should be
8. NAVIGATION — nav items overflowing or not fitting the mobile width
9. IMAGES — images overflowing or too large for mobile viewport

For each problem you see, identify which element needs fixing and what property to change.

AVAILABLE PROPERTIES:
font_size (int), padding_top/bottom/left/right (int), margin_top/bottom/left/right (int),
min_width_css (string "Npx"), min_height_css (string "Npx"), single_width (bool), fit_width (bool),
row_gap (int), column_gap (int), horiz_alignment (string), is_visible (bool),
letter_spacing (float), line_height (float)

RULES:
- min_width_css must be pixel string like "272px", NEVER percentages
- To stack cards: single_width:false + min_width_css:"272px"
- Minimum font_size: 12px text, 14px buttons
- is_visible:false only for elements that genuinely don't fit (like desktop nav menus)
${changesSummary}

ELEMENT MAP (id → name):
${this._buildElementMap(tree)}

RESPOND with ONLY JSON:
{
  "reasoning": {"elementId": "what I see wrong in the screenshot and how to fix it"},
  "changes": {"elementId": {"built-in-mobile-landing": {"prop": value}, "built-in-mobile": {"prop": value}}}
}
If everything looks correct: {"reasoning": {}, "changes": {}}`;
    },

    _buildElementMap(tree,prefix=''){
      if(!tree)return '';
      let result=(tree.name||tree.type)+' (id:'+tree.id.slice(0,12)+')\n';
      if(tree.kids){
        for(const kid of tree.kids){
          result+=this._buildElementMap(kid,prefix+'  ');
        }
      }
      return result;
    },

    // ─── TREE ENRICHMENT: Compute metadata Claude needs to reason ───
    _enrichTree(tree, parentAvailW, depth){
      if(!tree)return tree;
      const p=tree.props||{};
      const d=depth||0;

      // Calculate this element's available inner width for children
      const padL=p.padding_left||0;
      const padR=p.padding_right||0;
      const availW=parentAvailW?(parentAvailW-padL-padR):null;

      // For row containers: compute children overflow
      let childrenTotalMin=0;
      let overflows=false;
      if(p.container_layout==='row'&&tree.kids?.length){
        const gap=p.column_gap||0;
        childrenTotalMin=0;
        for(const kid of tree.kids){
          const kp=kid.props||{};
          if(kp.single_width){
            childrenTotalMin+=kp.min_width_css?parseInt(kp.min_width_css):200;
          }else if(kp.min_width_css&&kp.min_width_css.endsWith?.('px')){
            childrenTotalMin+=parseInt(kp.min_width_css);
          }else{
            childrenTotalMin+=50; // Stretch element with no min
          }
        }
        childrenTotalMin+=gap*(tree.kids.length-1);
        if(availW)overflows=childrenTotalMin>availW;
      }

      // Detect sibling groups (children of same type/structure)
      let siblingGroups=null;
      if(tree.kids?.length>1){
        const groups={};
        for(const kid of tree.kids){
          const sig=(kid.type||'')+'_'+(kid.kids?.length||0);
          if(!groups[sig])groups[sig]=[];
          groups[sig].push(kid.id);
        }
        const meaningful=Object.values(groups).filter(g=>g.length>1);
        if(meaningful.length)siblingGroups=meaningful;
      }

      // Add computed metadata
      tree._depth=d;
      if(availW)tree._availW=Math.round(availW);
      if(overflows)tree._overflows=true;
      if(childrenTotalMin>0)tree._childMinTotal=Math.round(childrenTotalMin);
      if(siblingGroups)tree._siblingGroups=siblingGroups;

      // Text context hints
      if(tree.text){
        const t=tree.text.toLowerCase();
        const fs=p.font_size||14;
        if(fs>=40)tree._role='heading';
        else if(fs>=24)tree._role='subheading';
        else if(tree.type?.includes?.('Button'))tree._role='cta';
        else if(t.length>100)tree._role='body';
        else tree._role='label';
      }

      // Recurse with availW for 320 context
      if(tree.kids){
        for(const kid of tree.kids){
          this._enrichTree(kid,availW||320,d+1);
        }
      }
      return tree;
    },

    // ─── THE PROMPT ───
    buildPrompt(tree){
      return `You are an expert Bubble.io responsive designer. Generate conditional overrides for mobile (320px) and tablet (768px). You are analyzing the ORIGINAL desktop element tree — no changes applied yet. Generate ALL necessary overrides from scratch.

══ VALID PROPERTIES (use ONLY these exact names) ══
Sizing: single_width (bool), fit_width (bool), min_width_css (string "Npx"), min_height_css (string "Npx")
Typography: font_size (int), letter_spacing (float), word_spacing (float), line_height (float)
Spacing: padding_top, padding_bottom, padding_left, padding_right, margin_top, margin_bottom, margin_left, margin_right (int px)
Layout: row_gap (int), column_gap (int), horiz_alignment ("left"|"center"|"right")
Visibility: is_visible (bool)

Do NOT invent properties. single_height, font_alignment, max_width_css DO NOT EXIST.

══ NEVER CHANGE ══
container_layout, bgcolor, background_style, border_roundness, font_family, font_weight, bold, italic, font_color, tag_type

══ CRITICAL RULES ══
1. is_visible:false — USE WISELY. You CAN hide elements that genuinely don't fit on mobile (like a desktop navigation menu with too many items). But NEVER hide: main CTAs, important buttons, content text, images, or headings. If you hide a nav menu, make sure there's a mobile alternative or the essential links/buttons remain visible.
2. is_visible:true — NEVER set this on elements hidden by default. They may be hidden intentionally (mobile-only menus, conditional elements).
3. min_width_css — MUST be pixel string like "272px". NEVER percentages ("90%"). NEVER larger than the breakpoint (max "288px" at 320, max "700px" at 768).
4. HTML elements — You CAN change their sizing properties (single_width, fit_width, min_width_css, min_height_css, padding, margin). But understand they contain rendered custom content (images, iframes, charts) so be conservative with dimensions.
5. Video elements — Same as HTML: you CAN adjust sizing/spacing, but be conservative.
6. Logo/brand text — NEVER reduce font_size below 75% of original (40px → min 30px).
7. Elements already in stretch mode (single_width:false + fit_width:false) — do NOT change width settings, they already adapt.
8. Padding/margin reduction — be proportional. 100px → 40px is fine. 100px → 10px is too aggressive.
9. font_size minimum: 12px for text, 14px for buttons. NEVER below these.
10. FloatingGroups (sticky headers) — reduce their padding for mobile but keep content visible. The section BELOW a FloatingGroup may need extra margin_top so content isn't hidden behind it.

══ BUBBLE.IO RESPONSIVE ENGINE ══
- Row layout = flexbox row + flex-wrap. Children wrap to next line when they don't fit.
- Column layout = flexbox column, children stack vertically.
- single_width:true = FIXED pixel width, will NOT shrink on smaller screens.
- single_width:false + fit_width:false = STRETCH to fill available parent width.
- single_width:false + fit_width:true = SHRINK to content width.
- To stack cards vertically on mobile: set each card single_width:false + min_width_css:"272px" (forces wrap)
- When changing single_width:true→false, MUST also set min_width_css to prevent collapse to 0.
- Available width for children = parent_width - padding_left - padding_right - gaps

══ BREAKPOINTS ══
"built-in-mobile-landing" = page width ≤ 768px (tablet)
"built-in-mobile" = page width ≤ 320px (phone)
768 overrides also apply at 320. Only add 320 override if the value needs to be DIFFERENT from 768.

══ FONT SCALING ══
60-80px → 768: 40-50px, 320: 28-36px
40-55px → 768: 32-40px, 320: 24-30px
25-35px → 768: 22-28px, 320: 18-24px
Below 20px → leave as-is unless causing overflow

══ WHAT TO FIX (priority order) ══
1. OVERFLOW: Fixed-width elements wider than breakpoint → make flexible with min_width_css
2. FLOATING HEADER OVERLAP: If a FloatingGroup exists, the first content section may need margin_top added
3. NAV OVERFLOW: If navigation items don't fit on mobile, hide the nav group. Reduce button padding/font to fit essential CTAs.
4. FONT SIZE: Scale large headings per guidelines above
5. PADDING: Reduce >60px horizontal padding proportionally (aim for 20-40px on mobile)
6. GAPS/MARGINS: Reduce oversized gaps and margins proportionally
7. HTML/CUSTOM ELEMENTS: If they have fixed widths that overflow, make them flexible
8. SIBLING CONSISTENCY: Cards, features, pricing items of same type MUST get identical overrides

══ OUTPUT FORMAT ══
ONLY valid JSON, no markdown, no backticks:
{
  "reasoning": {"elementId": "what's wrong and what I'm fixing"},
  "changes": {"elementId": {"built-in-mobile-landing": {"prop": value}, "built-in-mobile": {"prop": value}}}
}

ELEMENT TREE:
${JSON.stringify(tree,null,2)}`;
    },

    async _callClaude(tree){
      for(let attempt=0;attempt<5;attempt++){
        const resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',
          headers:{'Content-Type':'application/json','x-api-key':this.apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
          body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:8000,messages:[{role:'user',content:this.buildPrompt(tree)}]})
        });
        if(resp.status===429){const w=(attempt+1)*15000;UI.addLog('⏳ Rate limit, waiting '+w/1000+'s... (attempt '+(attempt+1)+'/5)','i');await new Promise(r=>setTimeout(r,w));continue}
        if(!resp.ok){const err=await resp.text();throw new Error('API '+resp.status+': '+err.slice(0,100))}
        const data=await resp.json();const text=data.content?.find(c=>c.type==='text')?.text||'';
        const clean=text.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
        const parsed=JSON.parse(clean);

        // Handle both formats: new {reasoning,changes} and legacy flat
        let changes, reasoning;
        if(parsed.changes){
          changes=parsed.changes;
          reasoning=parsed.reasoning||{};
        }else{
          // Legacy flat format — no reasoning
          changes=parsed;
          reasoning={};
        }

        // Log reasoning for each element
        if(Object.keys(reasoning).length>0){
          console.group('🤖 Claude reasoning');
          for(const[id,reason]of Object.entries(reasoning)){
            const name=E.elName(id)||id;
            const elChanges=changes[id]||{};
            console.log(`%c${name}%c — ${reason}`, 'font-weight:bold;color:#6C5CE7','color:inherit');
            console.log('  Changes:', JSON.stringify(elChanges));
          }
          console.groupEnd();
          // Also log to BBO UI panel
          UI.addLog('📋 Reasoning for '+Object.keys(reasoning).length+' elements (see console)','i');
        }

        // ── VALIDATION: sanitize Claude's output ──
        const VALID_PROPS=new Set(['font_size','letter_spacing','word_spacing','line_height','padding_top','padding_bottom','padding_left','padding_right','margin_top','margin_bottom','margin_left','margin_right','min_width_css','min_height_css','row_gap','column_gap','horiz_alignment','single_width','fit_width','is_visible']);
        let stripped=0, blocked=0;

        for(const[id,bps]of Object.entries(changes)){
          const node=this._findInTree(tree,id);
          const nodeType=node?.type||'';

          // Log HTML/Video changes for review (no longer blocking)
          if(nodeType==='HTML'||nodeType==='Video'){
            console.log(`ℹ️ ${nodeType} element modified: ${E.elName(id)||id}`);
          }

          for(const[bp,props]of Object.entries(bps)){
            for(const[prop,val]of Object.entries(props)){
              let remove=false;

              // Invalid property name
              if(!VALID_PROPS.has(prop)){
                console.warn(`🚫 STRIPPED invalid prop "${prop}" from ${E.elName(id)||id}`);
                remove=true;
              }
              // Percentage in min_width_css
              if(prop==='min_width_css'&&typeof val==='string'&&val.includes('%')){
                console.warn(`🚫 STRIPPED percentage min_width_css "${val}" from ${E.elName(id)||id}`);
                remove=true;
              }
              // Log visibility changes (for debugging, no longer hard-blocking)
              if(prop==='is_visible'&&val===false){
                console.log(`⚠️ Hiding element: ${E.elName(id)||id} (type: ${nodeType})`);
              }
              // Showing intentionally hidden elements
              if(prop==='is_visible'&&val===true&&node?.props?.is_visible===false){
                console.warn(`🚫 BLOCKED showing hidden element: ${E.elName(id)||id}`);
                remove=true;
              }

              if(remove){delete props[prop];stripped++}
            }
            if(Object.keys(props).length===0)delete bps[bp];
          }
          if(Object.keys(bps).length===0){delete changes[id];blocked++}
        }

        if(stripped>0||blocked>0){
          UI.addLog('🛡️ Sanitized: '+stripped+' props stripped, '+blocked+' elements blocked','i');
          console.log('🛡️ Sanitized: '+stripped+' props stripped, '+blocked+' elements blocked');
        }

        // Log final changes summary (after sanitization)
        const changeCount=Object.keys(changes).length;
        console.group('📊 Claude changes (after sanitization): '+changeCount+' elements');
        for(const[id,bps]of Object.entries(changes)){
          const name=E.elName(id)||id;
          const props=Object.entries(bps).map(([bp,p])=>bp.replace('built-in-mobile-landing','768').replace('built-in-mobile','320')+'→'+Object.entries(p).map(([k,v])=>k+'='+v).join(',')).join(' | ');
          console.log(`${name}: ${props}`);
        }
        console.groupEnd();

        return changes;
      }
      throw new Error('Rate limited after retries');
    },

    async analyzeSelected(){
      if(this.busy)return;const id=E.selId();
      if(!id){UI.toast(t('aiNoEl'),'err');return}
      if(!this.apiKey){UI.showKeyInput();return}
      this.busy=true;this.aborted=false;
      try{
        const tree=E.getTree(id);if(!tree)throw new Error('Cannot read element');

        UI.showAIProgress(t('aiAnalyzing'),0,1);
        UI.addLog('\xf0\x9f\xa4\x96 Claude analyzing...','i');
        const suggestions=await this._callClaude(tree);
        if(this.aborted){this.busy=false;return}

        if(!this.aborted)this._showResults(suggestions,tree);
      }catch(e){UI.toast(t('aiError')+': '+e.message?.slice(0,60),'err');UI.addLog(t('aiError'),'e')}
      this.busy=false;UI.hideAIProgress();
    },

    async analyzeFullPage(){
      if(this.busy)return;if(!this.apiKey){UI.showKeyInput();return}
      const sections=E.getPageSections();if(!sections.length){UI.toast('No sections','err');return}
      this.busy=true;this.aborted=false;

      // Step 1: Claude text analysis per section
      UI.addLog('\ud83e\udd16 Claude analyzing '+sections.length+' sections...','i');
      const all={};let i=0;
      const fullTree=E.getFullTree();

      for(const sec of sections){
        if(this.aborted)break;i++;
        const name=sec.name||sec.id;
        UI.showAIProgress(name+' ('+i+'/'+sections.length+')',i,sections.length);
        UI.addLog('\ud83e\udd16 '+name+' ('+i+'/'+sections.length+')','i');
        try{
          const tree=E.getTree(sec.id);if(!tree||!tree.kids?.length)continue;
          Object.assign(all,await this._callClaude(tree));
          if(i<sections.length)await new Promise(r=>setTimeout(r,8000));
        }catch(e){UI.addLog('\u26a0 '+name+': '+(e.message||'').slice(0,40),'e')}
      }
      if(this.aborted){this.busy=false;return}

      if(Object.keys(all).length===0){
        UI.toast(t('noChanges'),'err');
        this.busy=false;UI.hideAIProgress();
        return;
      }

      // Step 2: If screenshot server configured, apply changes → screenshot → vision review
      if(this.screenshotServer){
        UI.addLog('\ud83d\udcdd Applying changes temporarily for screenshot...','i');
        UI.showAIProgress('Applying changes...',0,1);

        // Save originals for revert
        const originals={};
        for(const elId of Object.keys(all)){
          try{originals[elId]=JSON.parse(JSON.stringify(appquery.by_id(elId).raw()))}catch(e){}
        }

        // Apply all changes to Bubble (temporary)
        let applied=0;
        for(const[elId,bps]of Object.entries(all)){
          for(const[bpId,props]of Object.entries(bps)){
            const ok=E.setCond(elId,bpId,props);
            if(ok)applied+=Object.keys(props).length;
          }
        }
        UI.addLog('\u2705 Applied '+applied+' changes temporarily','s');

        // Wait for Bubble to re-render
        await new Promise(r=>setTimeout(r,2000));

        // Take screenshots of the REAL page with changes applied
        UI.addLog('\ud83d\udcf8 Capturing real screenshots...','i');
        UI.showAIProgress('Capturing screenshots...',0,1);
        try{
          const screenshots=await this._captureScreenshots([320]);
          if(screenshots&&screenshots.length>0&&!this.aborted){
            UI.showAIProgress('Vision reviewing...',0,1);
            UI.addLog('\ud83d\udc41\ufe0f Claude Vision reviewing real screenshots...','i');
            const visionFixes=await this._callClaudeVision(screenshots,fullTree,all);

            const vfCount=Object.keys(visionFixes).length;
            if(vfCount>0){
              console.group('\ud83d\udc41\ufe0f Vision corrections: '+vfCount+' elements');
              for(const[id,bps]of Object.entries(visionFixes)){
                console.log((E.elName(id)||id)+': '+JSON.stringify(bps));
              }
              console.groupEnd();
              UI.addLog('\ud83d\udc41\ufe0f Vision: '+vfCount+' additional corrections','s');

              // Revert temporary changes before re-applying with corrections
              UI.addLog('\u21a9\ufe0f Reverting temporary changes...','i');
              for(const[elId,orig]of Object.entries(originals)){
                E.revertEl(elId,orig);
              }
              await new Promise(r=>setTimeout(r,500));

              // Merge vision corrections into changes
              for(const[id,bps]of Object.entries(visionFixes)){
                if(!all[id])all[id]={};
                for(const[bp,props]of Object.entries(bps)){
                  if(!all[id][bp])all[id][bp]={};
                  Object.assign(all[id][bp],props);
                }
              }
            }else{
              UI.addLog('\ud83d\udc41\ufe0f Vision: looks good!','s');
              // Revert — user will apply from the preview
              for(const[elId,orig]of Object.entries(originals)){
                E.revertEl(elId,orig);
              }
              await new Promise(r=>setTimeout(r,500));
            }
          }else{
            // No screenshots — revert
            for(const[elId,orig]of Object.entries(originals)){
              E.revertEl(elId,orig);
            }
          }
        }catch(e){
          UI.addLog('\u26a0 Vision failed: '+(e.message||'').slice(0,50)+' (text changes still available)','e');
          // Revert on error
          for(const[elId,orig]of Object.entries(originals)){
            E.revertEl(elId,orig);
          }
        }
      }

      // Step 3: Show results (user decides to apply or discard)
      if(!this.aborted)this._showResults(all,fullTree);
      this.busy=false;UI.hideAIProgress();
    },

    _findInTree(tree,id){if(!tree)return null;if(tree.id===id)return tree;if(tree.kids)for(const k of tree.kids){const f=this._findInTree(k,id);if(f)return f}return null},

    _mergeAF(base,over){
      const m=JSON.parse(JSON.stringify(base));
      for(const[id,bps]of Object.entries(over)){
        if(!m[id])m[id]={};
        for(const[bp,props]of Object.entries(bps)){
          if(!m[id][bp])m[id][bp]={};
          Object.assign(m[id][bp],props);
        }
      }
      return m;
    },


    _showResults(suggestions,tree){
      let tp=0,te=0;const originals={};
      for(const[elId,bps]of Object.entries(suggestions)){te++;for(const props of Object.values(bps))tp+=Object.keys(props).length;try{originals[elId]=JSON.parse(JSON.stringify(appquery.by_id(elId).raw()))}catch(e){}}
      this.pending={suggestions,originals,tree};
      UI.showAIPreview(suggestions,tree);
      UI.addLog('🎯 Total: '+tp+' changes → '+te+' elements','s');
    },

    apply(){
      if(!this.pending)return;const{suggestions,originals}=this.pending;let tc=0,te=0;
      for(const[elId,bps]of Object.entries(suggestions)){te++;for(const[bpId,props]of Object.entries(bps)){const ok=E.setCond(elId,bpId,props);if(ok)tc+=Object.keys(props).length}}
      R.undoData={};for(const[elId,orig]of Object.entries(originals))R.undoData[elId]={name:E.elName(elId),original:orig,breakpoints:suggestions[elId]};
      this.pending=null;UI.hideAIPreview();PV.close();
      if(tc>0){UI.showUndo(tc,te);UI.toast('✅ '+tc+' '+t('changes'),'ok');UI.addLog('✅ Applied '+tc+' → '+te+' elements','s')}
    },
    cancel(){this.pending=null;this.aborted=true;UI.hideAIPreview();UI.hideAIProgress();PV.close();UI.addLog('Cancelled','i')}
  };

  // ====================== UI ======================
  const UI={
    sh:null,
    inject(){
      const host=document.createElement('div');host.id='bbo-host';host.style.cssText='position:fixed;bottom:16px;right:16px;z-index:999999;';
      document.body.appendChild(host);const sh=host.attachShadow({mode:'open'});this.sh=sh;
      sh.innerHTML=`
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
:host{all:initial}*{box-sizing:border-box;margin:0;padding:0}
.panel{width:280px;background:#fff;border:1px solid #E0E0E0;border-radius:14px;overflow:hidden;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;color:#333;box-shadow:0 8px 32px rgba(0,0,0,0.08),0 2px 8px rgba(0,0,0,0.04);user-select:none}
.panel.min{width:40px;height:40px;border-radius:50%;cursor:pointer;background:linear-gradient(135deg,#FF6B35,#ff8f5e);border:none;box-shadow:0 4px 20px rgba(255,107,53,0.35);display:flex;align-items:center;justify-content:center}
.panel.min:hover{transform:scale(1.08)}.panel.min .bd{display:none}.panel.min .fab{display:flex;align-items:center;justify-content:center;width:100%;height:100%}.fab{display:none}.fab svg{width:18px;height:18px}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#FAFAFA;border-bottom:1px solid #EBEBEB}.hdr-left{display:flex;align-items:center;gap:6px}.hdr-logo svg{width:14px;height:14px}.hdr-title{font-size:10px;font-weight:700;color:#FF6B35;letter-spacing:0.5px;text-transform:uppercase}.hdr-acts{display:flex;align-items:center;gap:2px}.hdr-btn{background:none;border:none;color:#999;cursor:pointer;font-size:10px;padding:3px 6px;border-radius:4px;font-family:inherit}.hdr-btn:hover{color:#333;background:#F0F0F0}
.bd{padding:0}.sts{display:flex;gap:4px;padding:8px 12px;border-bottom:1px solid #F0F0F0}.sts-item{flex:1;text-align:center}.sts-lbl{font-size:7px;color:#AAA;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:1px}.sts-val{font-size:9px;font-weight:600;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sts-val.on{color:#FF6B35}.sts-val.ok{color:#2D9B53}
.tog{display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 12px;border-bottom:1px solid #F0F0F0}.tog:hover{background:#FAFAFA}.tog .lbl{font-size:10px;flex:1;font-weight:500;color:#666}.tog .sw{width:32px;height:16px;border-radius:16px;background:#DDD;position:relative;transition:.2s;flex-shrink:0}.tog .dt{width:12px;height:12px;border-radius:50%;background:#fff;position:absolute;top:2px;left:2px;transition:.2s;box-shadow:0 1px 2px rgba(0,0,0,0.15)}.tog.on .sw{background:#FF6B35}.tog.on .dt{left:18px}
.rec{display:none;padding:6px 12px;align-items:center;gap:8px;border-bottom:1px solid #F0F0F0}.rec.vis{display:flex}.rec-dot{width:6px;height:6px;border-radius:50%;background:#FF4444;flex-shrink:0;animation:blink 1.5s ease infinite}.rec.paused .rec-dot{background:#CCC;animation:none}@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}.rec-info{flex:1}.rec-text{font-size:9px;color:#FF6B35;font-weight:600}.rec.paused .rec-text{color:#AAA}.rec-stats{font-size:8px;color:#999}
.summary{padding:6px 12px;display:none}.summary.vis{display:block}.sum-hdr{font-size:8px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px}.sum-el{display:flex;align-items:center;justify-content:space-between;padding:4px 8px;margin-bottom:3px;border-radius:6px;background:#FAFAFA;border:1px solid #F0F0F0;font-size:9px}.sum-el-name{font-weight:600;color:#444}.sum-el-badges{display:flex;gap:3px}.sum-badge{font-size:7px;font-weight:700;padding:1px 5px;border-radius:3px;background:rgba(255,107,53,0.08);color:#FF6B35}
.copy-bar{display:none;padding:4px 12px 6px;gap:4px;flex-wrap:wrap}.copy-bar.vis{display:flex}.copy-btn{font-size:8px;padding:3px 8px;border-radius:4px;cursor:pointer;background:#F0F5FF;color:#3366CC;border:1px solid #D0DFFF;font-family:inherit;font-weight:500}.copy-btn:hover{background:#E0ECFF}
.ai-section{padding:6px 12px;border-top:1px solid #F0F0F0;display:flex;gap:6px}.ai-btn{flex:1;padding:7px 6px;border:none;border-radius:7px;font-size:9px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;text-align:center}.ai-btn:active{transform:scale(0.97)}.ai-btn:disabled{opacity:0.4;cursor:default;transform:none}.ai-btn-sel{background:linear-gradient(135deg,#6C5CE7,#a29bfe);color:white}.ai-btn-sel:hover:not(:disabled){box-shadow:0 2px 10px rgba(108,92,231,0.25)}.ai-btn-full{background:linear-gradient(135deg,#0984E3,#74b9ff);color:white}.ai-btn-full:hover:not(:disabled){box-shadow:0 2px 10px rgba(9,132,227,0.25)}
.ai-progress{display:none;padding:8px 12px;border-top:1px solid #F0F0F0}.ai-progress.vis{display:block}.ai-prog-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}.ai-spinner{width:12px;height:12px;border:2px solid #E0E0E0;border-top:2px solid #6C5CE7;border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}@keyframes spin{to{transform:rotate(360deg)}}.ai-prog-text{font-size:9px;color:#6C5CE7;font-weight:500;flex:1}.ai-prog-cancel{font-size:8px;color:#999;cursor:pointer;border:none;background:none;font-family:inherit;text-decoration:underline}.ai-prog-cancel:hover{color:#666}.ai-prog-bar{height:3px;background:#F0F0F0;border-radius:3px;overflow:hidden}.ai-prog-fill{height:100%;background:linear-gradient(90deg,#6C5CE7,#a29bfe);border-radius:3px;transition:width .3s}
.ai-key{display:none;padding:8px 12px;border-top:1px solid #F0F0F0}.ai-key.vis{display:block}.ai-key-lbl{font-size:8px;font-weight:600;color:#888;text-transform:uppercase;margin-bottom:4px}.ai-key-row{display:flex;gap:4px}.ai-key-input{flex:1;padding:5px 8px;border:1px solid #DDD;border-radius:5px;font-size:9px;font-family:inherit;outline:none}.ai-key-input:focus{border-color:#6C5CE7}.ai-key-save{padding:5px 10px;border:none;border-radius:5px;background:#6C5CE7;color:white;font-size:9px;font-weight:600;cursor:pointer;font-family:inherit}
.ai-preview{display:none;max-height:220px;overflow-y:auto;padding:6px 12px;border-top:1px solid #F0F0F0}.ai-preview.vis{display:block}.ai-preview::-webkit-scrollbar{width:3px}.ai-preview::-webkit-scrollbar-thumb{background:#DDD;border-radius:3px}.ai-pv-hdr{font-size:8px;font-weight:700;color:#6C5CE7;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between}.ai-pv-count{font-size:8px;font-weight:600;padding:1px 5px;border-radius:4px;background:rgba(108,92,231,0.1);color:#6C5CE7}.ai-pv-el{margin-bottom:6px}.ai-pv-el-name{font-size:9px;font-weight:600;color:#444;margin-bottom:2px}.ai-pv-bp{margin-left:8px;margin-bottom:3px}.ai-pv-bp-label{font-size:7px;font-weight:700;color:#999;text-transform:uppercase;margin-bottom:1px}.ai-pv-row{display:flex;justify-content:space-between;font-size:8px;padding:1px 0}.ai-pv-k{color:#888}.ai-pv-v{color:#6C5CE7;font-weight:600}
.ai-pv-actions{display:flex;gap:6px;margin-top:8px;padding-top:6px;border-top:1px solid #F0F0F0}.ai-pv-apply{flex:1;padding:7px;border:none;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit;background:#6C5CE7;color:white}.ai-pv-apply:hover{background:#5b4bd5}.ai-pv-preview{padding:7px 12px;border:1px solid #6C5CE7;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit;background:white;color:#6C5CE7}.ai-pv-cancel{padding:7px 12px;border:1px solid #E0E0E0;border-radius:6px;font-size:10px;cursor:pointer;font-family:inherit;background:white;color:#888}
.undo-bar{display:none;padding:8px 12px;align-items:center;gap:8px;background:#FFFBF0;border-top:1px solid #FFE4B0}.undo-bar.vis{display:flex}.undo-msg{flex:1;font-size:9px;color:#886B00;font-weight:500}.undo-btn{font-size:9px;font-weight:700;padding:4px 10px;border-radius:5px;background:#FF6B35;color:white;border:none;cursor:pointer;font-family:inherit}.undo-timer{font-size:8px;color:#CC9900;font-weight:600;min-width:20px;text-align:center}
.log-wrap{padding:4px 12px 8px}.log{font-size:8px;max-height:50px;overflow-y:auto;padding:4px 6px;background:#F7F7F7;border-radius:4px;font-family:'DM Sans',monospace;color:#AAA;line-height:1.5}.log::-webkit-scrollbar{width:2px}.log::-webkit-scrollbar-thumb{background:#DDD;border-radius:2px}.log .s{color:#2D9B53}.log .e{color:#D63031}.log .i{color:#999}
.toast{position:absolute;top:-40px;left:50%;transform:translateX(-50%) translateY(8px);padding:5px 12px;border-radius:7px;font-size:9px;font-weight:600;white-space:nowrap;opacity:0;transition:all .3s;pointer-events:none}.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}.toast.ok{background:#E8FAF0;color:#2D9B53;border:1px solid rgba(45,155,83,0.15)}.toast.err{background:#FFF0F0;color:#D63031;border:1px solid rgba(214,48,49,0.12)}
</style>
<div class="panel" id="P">
  <div class="fab" id="fab"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
  <div class="bd">
    <div class="hdr"><div class="hdr-left"><div class="hdr-logo"><svg viewBox="0 0 24 24" fill="none" stroke="#FF6B35" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div><span class="hdr-title">BBO</span></div><div class="hdr-acts"><button class="hdr-btn" id="lang-btn">ES</button><button class="hdr-btn" id="min-btn">&minus;</button></div></div>
    <div class="sts"><div class="sts-item"><div class="sts-lbl">MODE</div><div class="sts-val" id="sv-m">&mdash;</div></div><div class="sts-item"><div class="sts-lbl">BP</div><div class="sts-val" id="sv-b">&mdash;</div></div><div class="sts-item"><div class="sts-lbl">ELEMENT</div><div class="sts-val" id="sv-e">&mdash;</div></div></div>
    <div class="tog" id="tog"><span class="lbl" id="tog-lbl">Auto-save</span><div class="sw"><div class="dt"></div></div></div>
    <div class="rec" id="rec"><div class="rec-dot"></div><div class="rec-info"><div class="rec-text" id="rec-text">Recording</div><div class="rec-stats" id="rec-stats">0</div></div></div>
    <div class="summary" id="summary"><div class="sum-hdr">Recorded</div><div id="sum-list"></div></div>
    <div class="copy-bar" id="copy-bar"></div>
    <div class="ai-section" id="ai-section"><button class="ai-btn ai-btn-sel" id="ai-sel">🤖 AI Selected</button><button class="ai-btn ai-btn-full" id="ai-full">🌐 AI Full Page</button></div>
    <div class="ai-progress" id="ai-progress"><div class="ai-prog-row"><div class="ai-spinner"></div><div class="ai-prog-text" id="ai-prog-text">...</div><button class="ai-prog-cancel" id="ai-prog-cancel">cancel</button></div><div class="ai-prog-bar"><div class="ai-prog-fill" id="ai-prog-fill" style="width:0%"></div></div></div>
    <div class="ai-key" id="ai-key"><div class="ai-key-lbl">Anthropic API Key</div><div class="ai-key-row"><input class="ai-key-input" id="ai-key-input" type="password" placeholder="sk-ant-..." /><button class="ai-key-save" id="ai-key-save">Save</button></div></div>
    <div class="ai-preview" id="ai-preview"></div>
    <div class="undo-bar" id="undo-bar"><div class="undo-msg" id="undo-msg"></div><div class="undo-timer" id="undo-timer">15</div><button class="undo-btn" id="undo-btn">Undo</button></div>
    <div class="log-wrap"><div class="log" id="log"><div class="i">Ready — 3-Layer AI</div></div></div>
  </div>
  <div class="toast" id="toast"></div>
</div>`;
      this._ev();this._loop();AI.loadKey();
    },
    $(id){return this.sh.getElementById(id)},
    _ev(){
      this.$('tog').addEventListener('click',()=>{R.active=!R.active;this.$('tog').classList.toggle('on',R.active);if(R.active&&E.isResp()){R.wasResp=true;if(E.selId())R.snap()}this.addLog(R.active?'⚡ ON':'Paused',R.active?'s':'i');this.refresh()});
      this.$('min-btn').addEventListener('click',e=>{e.stopPropagation();this.$('P').classList.add('min')});
      this.$('P').addEventListener('click',()=>{if(this.$('P').classList.contains('min'))this.$('P').classList.remove('min')});
      this.$('lang-btn').addEventListener('click',()=>{lang=lang==='en'?'es':'en';this.$('lang-btn').textContent=t('lang');this.$('tog-lbl').textContent=t('autoSave');this.$('ai-sel').textContent='🤖 '+t('aiSelected');this.$('ai-full').textContent='🌐 '+t('aiFull');this.refresh()});
      this.$('undo-btn').addEventListener('click',()=>R.undo());
      this.$('ai-sel').addEventListener('click',()=>AI.analyzeSelected());
      this.$('ai-full').addEventListener('click',()=>AI.analyzeFullPage());
      this.$('ai-prog-cancel').addEventListener('click',()=>AI.cancel());
      this.$('ai-key-save').addEventListener('click',()=>{const key=this.$('ai-key-input').value.trim();if(key&&key.startsWith('sk-')){AI.saveKey(key);this.$('ai-key').classList.remove('vis');this.toast(t('aiKeySaved'),'ok')}});
      this.$('ai-key-input').addEventListener('keydown',e=>{if(e.key==='Enter')this.$('ai-key-save').click()});
      window.addEventListener('keydown',e=>{if(e.ctrlKey&&e.shiftKey&&e.code==='KeyB'){e.preventDefault();this.$('tog').click()}},true);
    },
    _loop(){
      setInterval(()=>{
        const resp=E.isResp(),raw=E.selRaw(),id=E.selId();const bp=resp?E.bp():null,b=bp?BP[bp]:null;
        this.$('sv-m').textContent=resp?t('responsive'):t('design');this.$('sv-m').className='sts-val'+(resp?' on':'');
        this.$('sv-b').textContent=b?'\u2264'+b.w+'px':'\u2014';this.$('sv-b').className='sts-val'+(b&&!GLOBAL.has(bp)?' on':'');
        this.$('sv-e').textContent=raw?.name||id||'\u2014';this.$('sv-e').className='sts-val'+(raw?' ok':'');
        const rec=this.$('rec');if(R.active&&resp){rec.classList.add('vis');rec.classList.toggle('paused',GLOBAL.has(bp));this.$('rec-text').textContent=GLOBAL.has(bp)?t('paused'):t('recording');const s=R.stats();this.$('rec-stats').textContent=s.changes+' '+t('changes')+' \u00b7 '+s.els+' '+t('elements')}else{rec.classList.remove('vis')}
        R.tick();this._updateCopy(id);this._updateSummary();this.$('ai-sel').disabled=!id||AI.busy;this.$('ai-full').disabled=AI.busy;
      },700);
    },
    _updateSummary(){const p=this.$('summary'),l=this.$('sum-list');const ed=R.editedElements();if(!ed.length){p.classList.remove('vis');return}let h='';for(const el of ed.slice(0,6)){const badges=Object.entries(el.breakpoints).map(([bpId,props])=>'<span class="sum-badge">'+(BP[bpId]?.w||'?')+'px\u00b7'+Object.keys(props).length+'</span>').join('');h+='<div class="sum-el"><span class="sum-el-name">'+el.name+'</span><div class="sum-el-badges">'+badges+'</div></div>'}if(ed.length>6)h+='<div style="font-size:8px;color:#AAA;padding:2px 8px">+'+(ed.length-6)+' more</div>';l.innerHTML=h;p.classList.add('vis')},
    _updateCopy(curId){const bar=this.$('copy-bar');if(!R.active||!curId||!E.isResp()){bar.classList.remove('vis');return}const ed=R.editedElements().filter(e=>e.id!==curId);if(!ed.length){bar.classList.remove('vis');return}bar.innerHTML=ed.slice(0,3).map(e=>'<button class="copy-btn" data-id="'+e.id+'">'+t('copyFrom')+' '+e.name+'</button>').join('');bar.classList.add('vis');bar.querySelectorAll('.copy-btn').forEach(btn=>{btn.addEventListener('click',()=>{if(R.copyFrom(btn.getAttribute('data-id')))this.toast('✅','ok')})})},
    showKeyInput(){this.$('ai-key').classList.add('vis');this.$('ai-key-input').focus()},
    showAIProgress(text,cur,total){this.$('ai-progress').classList.add('vis');this.$('ai-section').style.display='none';this.$('ai-prog-text').textContent=text;this.$('ai-prog-fill').style.width=total>0?Math.round((cur/total)*100)+'%':'0%'},
    hideAIProgress(){this.$('ai-progress').classList.remove('vis');this.$('ai-section').style.display=''},
    showAIPreview(sug,tree){
      const p=this.$('ai-preview');let tp=0;
      let h='<div class="ai-pv-hdr"><span>'+t('aiPreview')+'</span><span class="ai-pv-count" id="ai-pv-total">0</span></div>';
      for(const[elId,bps]of Object.entries(sug)){const name=E.elName(elId);h+='<div class="ai-pv-el"><div class="ai-pv-el-name">'+name+'</div>';for(const[bpId,props]of Object.entries(bps)){h+='<div class="ai-pv-bp"><div class="ai-pv-bp-label">\u2264'+(BP[bpId]?.w||'?')+'px</div>';for(const[k,v]of Object.entries(props)){tp++;h+='<div class="ai-pv-row"><span class="ai-pv-k">'+prettyKey(k)+'</span><span class="ai-pv-v">'+prettyVal(v)+'</span></div>'}h+='</div>'}h+='</div>'}
      h+='<div class="ai-pv-actions"><button class="ai-pv-apply" id="ai-apply">'+t('aiApply')+' ('+tp+')</button>'+(tree?'<button class="ai-pv-preview" id="ai-pv-open">👁 Preview</button>':'')+'<button class="ai-pv-cancel" id="ai-cancel">'+t('aiCancel')+'</button></div>';
      p.innerHTML=h;const c=this.sh.getElementById('ai-pv-total');if(c)c.textContent=tp;p.classList.add('vis');
      this.sh.getElementById('ai-apply')?.addEventListener('click',()=>AI.apply());
      this.sh.getElementById('ai-cancel')?.addEventListener('click',()=>AI.cancel());
      if(tree)this.sh.getElementById('ai-pv-open')?.addEventListener('click',()=>PV.show(tree,sug,'built-in-mobile'));
    },
    hideAIPreview(){this.$('ai-preview').classList.remove('vis')},
    showUndo(c,e){this.$('undo-msg').textContent='✅ '+c+' → '+e+' el';this.$('undo-bar').classList.add('vis');let sec=15;this.$('undo-timer').textContent=sec;if(R.undoTimer)clearInterval(R.undoTimer);R.undoTimer=setInterval(()=>{sec--;this.$('undo-timer').textContent=sec;if(sec<=0){clearInterval(R.undoTimer);R.undoTimer=null;R.undoData=null;this.hideUndo()}},1000)},
    hideUndo(){this.$('undo-bar').classList.remove('vis');if(R.undoTimer){clearInterval(R.undoTimer);R.undoTimer=null}},
    refresh(){this._updateSummary()},
    toast(msg,type){const el=this.$('toast');el.textContent=msg;el.className='toast '+type+' show';setTimeout(()=>el.classList.remove('show'),2500)},
    addLog(msg,cls){const el=this.$('log');if(!el)return;const d=document.createElement('div');d.className=cls||'i';d.textContent=new Date().toLocaleTimeString().slice(0,5)+' '+msg;el.insertBefore(d,el.firstChild);while(el.children.length>15)el.removeChild(el.lastChild)}
  };

  // PUBLIC API
  window.BBO={
    override(b,p){const i=E.selId();return i?E.setCond(i,b,p):false},
    tablet(p){return this.override('built-in-mobile-landing',p)},mobile(p){return this.override('built-in-mobile',p)},laptop(p){return this.override('built-in-tablet',p)},
    status(){return{active:R.active,resp:E.isResp(),bp:E.bp(),el:E.selId(),...R.stats()}},
    states(){return E.selRaw()?.states},session(){return R.data},
    clear(){R.clear()},undo(){R.undo()},
    on(){R.active=true;R.wasResp=E.isResp();UI.$('tog')?.classList.add('on')},
    off(){R.active=false;UI.$('tog')?.classList.remove('on')},
    ai(){AI.analyzeSelected()},aiPage(){AI.analyzeFullPage()},setKey(k){AI.saveKey(k)},
    tree(id){return E.getTree(id||E.selId())},fullTree(){return E.getFullTree()},sections(){return E.getPageSections()},
    preview(bp){if(AI.pending)PV.show(AI.pending.tree,AI.pending.suggestions,bp||'built-in-mobile')},
    autoFix(bp){const ft=E.getFullTree();return AF.run(ft,bp||'built-in-mobile')},
    setScreenshotServer(url){AI.saveScreenshotServer(url);console.log('✅ Screenshot server set to:',url)},
    recorder:R,editor:E,ui:UI,aiModule:AI,previewer:PV,autoFixer:AF
  };

  (async()=>{
    log('v7.0.0 — Vision + Screenshot Server...');
    await new Promise(r=>{const c=()=>{try{if(typeof Lib==='function'&&typeof appquery!=='undefined'&&Lib().design_tab)r();else setTimeout(c,1e3)}catch(e){setTimeout(c,1e3)}};c()});
    UI.inject();log('✅ Ready');
  })();
})();
