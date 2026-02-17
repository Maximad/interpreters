FROM nginx:1.27-alpine
COPY infra/nginx.prod.conf /etc/nginx/nginx.conf
