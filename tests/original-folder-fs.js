export function setDesktopFsRemotePicker(picker){window.originalPicker=picker}
export async function readDesktopDir(path){return {entries:(path==='/fixture/hermes'?['first','second']:['child']).map(name=>({name,path:path+'/'+name,isDirectory:true}))}}
export async function createRemoteDir(path){return path}
