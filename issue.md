1.添加交流日志的面板里面的“添加记录”按钮应该再往左一点，现在和关闭的×重合了
2.删除合作者的时候报错：CollaboratorManagement.tsx:231 
 GET http://45.149.156.216:3001/api/validation/collaborator/27/dependencies 401 (Unauthorized)
(anonymous)	@	CollaboratorManagement.tsx:231
onClick	@	CollaboratorManagement.tsx:553
CollaboratorManagement.tsx:231 
 GET http://45.149.156.216:3001/api/validation/collaborator/27/dependencies 401 (Unauthorized)
(anonymous)	@	CollaboratorManagement.tsx:231
onClick	@	CollaboratorManagement.tsx:553
(anonymous)	@	button.js:186
ze	@	react-dom.production.min.js:54
Ae	@	react-dom.production.min.js:54
(anonymous)	@	react-dom.production.min.js:55
_r	@	react-dom.production.min.js:105
Br	@	react-dom.production.min.js:106
(anonymous)	@	react-dom.production.min.js:117
cc	@	react-dom.production.min.js:273
Pe	@	react-dom.production.min.js:52
qr	@	react-dom.production.min.js:109
Ut	@	react-dom.production.min.js:74
Kt	@	react-dom.production.min.js:73
3.新建和编辑合作者里面的学校、专业、联系方式这三个去掉，高级合作者改成打勾的方式，还有小组的打勾选项没有了？加上
4.idea发掘面板应该加入四个子面板，四个独立的子列表，但所有用户都能访问和修改，你逻辑错了
5.idea管理界面不需要子面板，所有人都一个list