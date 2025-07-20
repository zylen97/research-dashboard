from app.models.database import SessionLocal, User
from app.utils.auth import get_password_hash

db = SessionLocal()

user = db.query(User).filter(User.username == "user1").first()
if user:
    user.username = "zl"
    user.display_name = "ZL"
    user.password_hash = get_password_hash("123")
    print("Updated user1 -> zl")

user = db.query(User).filter(User.username == "user2").first()
if user:
    user.username = "zz"
    user.display_name = "ZZ"
    user.password_hash = get_password_hash("123")
    print("Updated user2 -> zz")

user = db.query(User).filter(User.username == "user3").first()
if user:
    user.username = "yq"
    user.display_name = "YQ"
    user.password_hash = get_password_hash("123")
    print("Updated user3 -> yq")

user = db.query(User).filter(User.username == "user4").first()
if user:
    user.username = "dz"
    user.display_name = "DZ"
    user.password_hash = get_password_hash("123")
    print("Updated user4 -> dz")

db.commit()
db.close()
print("✅ 全部更新完成！")