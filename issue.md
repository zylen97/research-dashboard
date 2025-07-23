1.研究看板中增加待办是独立的吗，每个用户增加自己的待办，互相看不到彼此的待办，增加这个功能
2.系统设置中的api密钥，api地址和默认模型，全都都必填，api密钥默认用sk-LrOwl2ZEbKhZxW4s27EyGdjwnpZ1nDwjVRJk546lSspxHymY,api地址用https://api.chatanywhere.tech/v1，模型用claude-3-7-sonnet-20250219

claude-sonnet-4-20250514

claude-opus-4-20250514-thinking

claude-opus-4-20250514

deepseek-v3

deepseek-r1

gpt-4.1

gpt-4o

gpt-4o

gpt-4o-mini

把这些模型，做一个下拉选项，然后选择

3.idea管理面板，显示加载idea失败，报错：Failed to load resource: the server responded with a status of 404 (Not Found)Understand this error
api.ts:60 API Error: cF
(anonymous) @ api.ts:60Understand this error
api.ts:81 请求的资源不存在
(anonymous) @ api.ts:81Understand this error
IdeasManagement.tsx:46 加载Ideas失败: cF
f @ IdeasManagement.tsx:46Understand this error
api/ideas-management/collaborators/senior:1  Failed to load resource: the server responded with a status of 404 (Not Found)Understand this error
api.ts:60 API Error: cF
(anonymous) @ api.ts:60Understand this error
api.ts:81 请求的资源不存在
(anonymous) @ api.ts:81Understand this error
IdeasManagement.tsx:58 加载合作者失败: cF
修复

4.除了上述问题，全面检查软件数据库的api接口，和后端的匹配问题，仔细检查，不要漏过任何一项！！！