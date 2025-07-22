工程做以下方面的优化，自行判断需要做前端、后端还是数据库的调整，Ultra think.

1.research dashboard v5.0以及后面有个火箭图标，v5.0和后面的火箭图标去掉
2.前后端数据库中，不是有四个用户可以登入吗，有一个用户叫dz，都改为dj
3.右上角图标拉出来里面有设置，把设置功能去掉
4.数据库备份功能从右上角图标迁移到左边，idea管理的下面
5.新建项目的时候，有一个项目“预计完成时间”不需要这个，删除这个
6.现在在vps添加交流日志时会显示失败，报错：CommunicationLogModal.tsx:106 提交交流日志失败: 
RA
code
: 
"ERR_BAD_REQUEST"
config
: 
{transitional: {…}, adapter: Array(3), transformRequest: Array(1), transformResponse: Array(1), timeout: 30000, …}
message
: 
"Request failed with status code 422"
name
: 
"AxiosError"
request
: 
XMLHttpRequest {onreadystatechange: null, readyState: 4, timeout: 30000, withCredentials: false, upload: XMLHttpRequestUpload, …}
response
: 
{data: {…}, status: 422, statusText: 'Unprocessable Entity', headers: dW, config: {…}, …}
status
: 
422
stack
: 
"AxiosError: Request failed with status code 422\n    at vW (http://45.149.156.216:3001/static/js/main.c698652e.js:2:1225381)\n    at XMLHttpRequest.g (http://45.149.156.216:3001/static/js/main.c698652e.js:2:1229976)\n    at nK.request (http://45.149.156.216:3001/static/js/main.c698652e.js:2:1238363)\n    at async onFinish (http://45.149.156.216:3001/static/js/main.c698652e.js:2:1257065)"
[[Prototype]]
: 
Error
onFinish	@	CommunicationLogModal.tsx:106
7.在“新增合作者”中和“编辑合作者”中可以选择将合作者修改为“高级合作者”，高级合作者永远置顶，头像显示为金色的（之前的前后端和db设置有，你查找一下，然后加入我这个功能）