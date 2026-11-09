import React from 'react'
import {createRoot} from 'react-dom/client'
import {RemoteFolderPicker} from './original-remote-picker.tsx'
createRoot(document.getElementById('pane')).render(<RemoteFolderPicker />)
