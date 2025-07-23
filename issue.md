结合前端和后端和数据库进行如下开发：

idea发掘面板：

1.无法上传xlsx，报错：POST http://localhost:8001/api/folders/create 500 (Internal Server Error)
dispatchXhrRequest @ axios.js?v=e6383e6c:1651
xhr @ axios.js?v=e6383e6c:1531
dispatchRequest @ axios.js?v=e6383e6c:2006
Promise.then
_request @ axios.js?v=e6383e6c:2209
request @ axios.js?v=e6383e6c:2118
httpMethod @ axios.js?v=e6383e6c:2256
wrap @ axios.js?v=e6383e6c:8
createFolder @ folderApi.ts:16
handleSaveFolder @ LiteratureManagement.tsx:199
await in handleSaveFolder
handleOk @ antd.js?v=e6383e6c:19355
(anonymous) @ antd.js?v=e6383e6c:13632
callCallback2 @ chunk-PJEEZAML.js?v=e6383e6c:3674
invokeGuardedCallbackDev @ chunk-PJEEZAML.js?v=e6383e6c:3699
invokeGuardedCallback @ chunk-PJEEZAML.js?v=e6383e6c:3733
invokeGuardedCallbackAndCatchFirstError @ chunk-PJEEZAML.js?v=e6383e6c:3736
executeDispatch @ chunk-PJEEZAML.js?v=e6383e6c:7014
processDispatchQueueItemsInOrder @ chunk-PJEEZAML.js?v=e6383e6c:7034
processDispatchQueue @ chunk-PJEEZAML.js?v=e6383e6c:7043
dispatchEventsForPlugins @ chunk-PJEEZAML.js?v=e6383e6c:7051
(anonymous) @ chunk-PJEEZAML.js?v=e6383e6c:7174
batchedUpdates$1 @ chunk-PJEEZAML.js?v=e6383e6c:18913
batchedUpdates @ chunk-PJEEZAML.js?v=e6383e6c:3579
dispatchEventForPluginEventSystem @ chunk-PJEEZAML.js?v=e6383e6c:7173
dispatchEventWithEnableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay @ chunk-PJEEZAML.js?v=e6383e6c:5478
dispatchEvent @ chunk-PJEEZAML.js?v=e6383e6c:5472
dispatchDiscreteEvent @ chunk-PJEEZAML.js?v=e6383e6c:5449Understand this error
2.功能说明部分，删除，不需要
