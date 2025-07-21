# 在VPS上运行
  cd /var/www/research-dashboard/frontend

  # 1. 解压
  tar -xzf build.tar.gz

  # 2. 部署到网站目录
  rm -rf /var/www/html/*
  cp -r build/* /var/www/html/
  chown -R www-data:www-data /var/www/html