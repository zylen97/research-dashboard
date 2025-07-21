1.在这个工程中，我所有的目的都是为了在vps做这个web应用，所以你在本地代码撰写时，也要考虑这个工程最后会通过github的action推送到vps上，在vps上实现功能。
2.deploy-scripts/deploy.sh和deploy-scripts/vps-update.sh是前端交互的重要部署文件，不要删除！
3.所有需要提交到vps的修改，请使用./deploy.sh来进行提交，不要自己git！
4.前端或后端以及其交互的任何修改，先在本地开发，然后通过./deploy.sh推到vps.