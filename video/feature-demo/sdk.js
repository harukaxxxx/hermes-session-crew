// Isolated fixture SDK: no network, host bridge, or real state.
import React,{useSyncExternalStore} from 'react';
import odin from './avatars/odin.png';import heimdall from './avatars/heimdall.png';import loki from './avatars/loki.png';import thor from './avatars/thor.png';import tyr from './avatars/tyr.png';import freyja from './avatars/freyja.png';import frigg from './avatars/frigg.png';import baldr from './avatars/baldr.png';
const avatars={default:odin,heimdall,loki,thor,tyr,freyja,frigg,baldr};
export {useQuery} from '@tanstack/react-query';
export const Popover=({children})=>children;
export const PopoverTrigger=({children})=>children;
export const PopoverContent=()=>null;
const atom=v=>({get:()=>v,subscribe:()=>()=>{}});
export const useValue=a=>useSyncExternalStore(a.subscribe,a.get,a.get);
export const host={state:{connectionId:atom('scripted-preview-33'),profile:atom('fixture')},profiles:{list:async()=>({profiles:window.demo.profiles})},request:async(method,params)=>method==='profiles.get_asset'&&avatars[params.name]?{found:true,data:avatars[params.name]}:{found:false},profileRoutes:async()=>[],onEvent:()=>()=>{}};
let messages={};
export const fixtureI18n={register:m=>messages=m,t:(key,...args)=>translate(key,...args)};
function translate(key,...args){const get=l=>key.split('.').reduce((x,k)=>x?.[k],messages[l]);const v=get('en');return typeof v==='function'?v(...args):v??key}
export const usePluginI18n=()=>translate;
