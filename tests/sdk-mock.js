export { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx'
export { Codicon } from '@/components/ui/codicon.tsx'
export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog.tsx'
export { Button } from '@/components/ui/button.tsx'
export { Input } from '@/components/ui/input.tsx'
export { Textarea } from '@/components/ui/textarea.tsx'
import { QueryClient } from '@tanstack/react-query'
export { useQuery } from '@tanstack/react-query'
export const queryClient = new QueryClient({defaultOptions:{queries:{retry:false}}})
export const useGatewayActivationEpoch=()=>1
export const gatewayActivationEpoch=()=>1
import {useSyncExternalStore} from 'react'
// Existing visual baselines are Traditional Chinese. Tests can opt into the
// plugin's English default with ?locale=en; use the public SDK i18n contract.
let fixtureLocale=new URLSearchParams(location.search).get('locale')||'zh-hant';const localeListeners=new Set();window.fixtureSetLocale=value=>{fixtureLocale=value;for(const notify of localeListeners)notify()}
let fixtureMessages={}
const translate=(key,...args)=>{const get=locale=>key.split('.').reduce((node,part)=>node?.[part],fixtureMessages[locale]);const value=get(fixtureLocale)??get('en');return typeof value==='function'?value(...args):typeof value==='string'?value:key}
export const fixtureI18n={register:messages=>{fixtureMessages=messages},t:translate}
export const usePluginI18n=()=>{const locale=useSyncExternalStore(fn=>{localeListeners.add(fn);return()=>localeListeners.delete(fn)},()=>fixtureLocale);return (key,...args)=>{const get=l=>key.split('.').reduce((node,part)=>node?.[part],fixtureMessages[l]);const value=get(locale)??get('en');return typeof value==='function'?value(...args):typeof value==='string'?value:key}}
const atom=value=>{const listeners=new Set();return {get:()=>value,set:v=>{value=v;for(const f of listeners)f()},subscribe:f=>{listeners.add(f);return()=>listeners.delete(f)}}}
const profileAtom=atom(new URLSearchParams(location.search).has('snapshot')?'default':'Aster');window.fixtureSetProfile=v=>profileAtom.set(v)
const listeners=new Map();window.emitFixtureGatewayEvent=event=>listeners.get(event.type)?.(event)
export const host = {...(window.fixtureOpenProjectDialog?{openProjectDialog:route=>window.fixtureOpenProjectDialog(route)}:{}),onEvent:(type,fn)=>{listeners.set(type,fn);return()=>listeners.delete(type)},state:{connectionId:atom('fixture'),profile:profileAtom},profiles:{list:async()=>({profiles:window.fixtureProfiles})},profileRoutes:async()=>window.fixtureProfiles.map(p=>({connectionId:'fixture',mode:'remote',profile:p.name,targetProfile:p.name})),request:async(method,params)=>{if(method==='profiles.get_asset'&&new URLSearchParams(location.search).has('gallery')){const canvas=document.createElement('canvas');canvas.width=canvas.height=37;const c=canvas.getContext('2d'),i=Math.max(0,window.fixtureProfiles.findIndex(p=>p.name===params.name));c.fillStyle=['#4d7385','#805a69','#6d7887','#6e806e'][i%4];c.fillRect(0,0,37,37);c.fillStyle='#e0c4ac';c.beginPath();c.arc(18.5,14,7,0,Math.PI*2);c.fill();c.fillStyle='#273940';c.beginPath();c.ellipse(18.5,34,14,12,0,0,Math.PI*2);c.fill();return {found:true,data:canvas.toDataURL('image/png')}}return {found:false}},openSession:async(...args)=>{window.openCalls=(window.openCalls||[]).concat([args])},requestProfile:async(route,method,params)=>method==='projects.create'?(window.projectCreateCalls=(window.projectCreateCalls||[]).concat([{route,params}]),{project:{id:'fixture-project',name:params.name,primary_path:params.primary_path}}):method==='session.create'?(window.createCalls=(window.createCalls||[]).concat([{route,params}]),{stored_session_id:'fixture-new'}):method==='session.list'?(new URLSearchParams(location.search).has('error')?Promise.reject(Error('fixture session error')):{sessions:Array.from({length:24},(_,i)=>({id:'id'+i,title:i?'Session '+i:'Very long session title '.repeat(8),last_active:24-i}))}):new URLSearchParams(location.search).has('pending')?new Promise(()=>{}):{projects:window.fixtureProjects||[{id:'p',label:'Very long project title '.repeat(8),path:'/fixture/project',sessionIds:['id0'],repos:[]}]}}
host.activeConnectionId=()=>host.state.connectionId.get()
window.fixtureSetConnection = value => host.state.connectionId.set(value)
export const useValue = x => useSyncExternalStore(x.subscribe,x.get,x.get)
