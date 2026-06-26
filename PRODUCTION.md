# 🌅 Solaris Production Deployment Guide

Quick reference for going live with Solaris.

---

## 🎯 Deployment Options (Choose One)

### 1. **Abacus.AI SuperComputer** ⭐ (Recommended)
**Always-on, managed hosting with custom domain**
- **Cost**: $10/month
- **Setup time**: 30 minutes
- **Guide**: See `SUPERCOMPUTER.md`
- **Best for**: Production apps, real users, peace of mind

### 2. **Railway** ⚡ (Fast & Easy)
**One-click deploy from GitHub**
- **Cost**: Free tier (500hrs/mo) or $5/mo
- **Setup time**: 10 minutes
- **Guide**: See `DEPLOYMENT.md` → Railway section
- **Best for**: MVPs, rapid iteration

### 3. **Render** 🎨
**Simple PaaS with free tier**
- **Cost**: Free (spins down) or $7/mo
- **Setup time**: 15 minutes
- **Guide**: See `DEPLOYMENT.md` → Render section
- **Best for**: Side projects, demos

### 4. **Self-Hosted VPS** 🛡️ (Most Sovereign)
**Full control on DigitalOcean, Hetzner, etc.**
- **Cost**: $5-20/month
- **Setup time**: 1-2 hours
- **Guide**: See `DEPLOYMENT.md` → Self-hosted section
- **Best for**: Maximum privacy, custom infrastructure

---

## 🚀 Quick Start: Docker Anywhere

Works on **any** platform with Docker:

```bash
# 1. Set secrets
export DB_PASSWORD="your_secure_password"
export JWT_SECRET="your_secure_jwt_secret"
export API_URL="https://yourdomain.com/api"

# 2. Deploy
docker-compose --env-file .env.production up -d

# 3. Seed database
docker-compose run --rm seed

# 4. Check logs
docker-compose logs -f

# 5. Access
open http://localhost:3000
```

**That's it!** Works on:
- Abacus.AI SuperComputer ✅
- Railway ✅
- Render ✅
- Fly.io ✅
- AWS/GCP/Azure ✅
- Your laptop ✅

---

## 📋 Pre-Launch Checklist

### Security
- [ ] Change `JWT_SECRET` (use: `openssl rand -hex 32`)
- [ ] Change database password
- [ ] Update CORS origins to your domain only
- [ ] Remove or change demo user passwords
- [ ] Enable rate limiting
- [ ] Set up SSL/HTTPS (auto on most platforms)

### Configuration
- [ ] Set `NODE_ENV=production`
- [ ] Update `VITE_API_URL` to production URL
- [ ] Remove demo autofill buttons (optional)
- [ ] Configure database backups
- [ ] Set up error logging (Sentry)

### Testing
- [ ] Test all user flows end-to-end
- [ ] Test on mobile devices
- [ ] Run Lighthouse audit (aim for 90+)
- [ ] Load test API endpoints
- [ ] Verify email notifications work (if applicable)

### Monitoring
- [ ] Set up uptime monitoring (UptimeRobot)
- [ ] Configure error alerts
- [ ] Add analytics (PostHog, Plausible)
- [ ] Document rollback procedure

---

## 🔄 Update Procedure

### Docker deployment:
```bash
git pull origin main
docker-compose down
docker-compose build
docker-compose up -d
```

### Native deployment:
```bash
git pull origin main
cd backend && npm install --production
sudo systemctl restart solaris-backend
cd .. && npm run build
```

---

## 📊 Monitoring Endpoints

### Health check
```bash
curl https://yourdomain.com/api/health
# Expected: 200 OK

curl https://yourdomain.com/api/auth/login -d '{"email":"test","password":"test"}'
# Expected: 401 (proves backend is working)
```

### Database
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
# Shows total users
```

### Logs
```bash
# Docker
docker-compose logs -f backend
docker-compose logs -f frontend

# Native
sudo journalctl -u solaris-backend -f
tail -f /var/log/nginx/access.log
```

---

## 💾 Backup Strategy

### Automated daily backups (recommended)
```bash
# Cron job for daily backup
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/solaris-$(date +\%Y\%m\%d).sql.gz

# Cleanup old backups (keep 30 days)
0 3 * * * find /backups -name "solaris-*.sql.gz" -mtime +30 -delete
```

### Manual backup
```bash
pg_dump $DATABASE_URL > solaris-backup-$(date +%Y%m%d).sql
```

### Restore
```bash
psql $DATABASE_URL < solaris-backup-YYYYMMDD.sql
```

---

## 🆘 Emergency Procedures

### Site is down
1. Check service status: `docker-compose ps` or `systemctl status solaris-backend`
2. Check logs for errors
3. Restart services: `docker-compose restart` or `sudo systemctl restart solaris-backend nginx`
4. If database issue: check connection string and Postgres status

### Database corruption
1. Stop backend
2. Restore from latest backup
3. Apply any missing migrations
4. Restart backend
5. Verify data integrity

### Rollback to previous version
```bash
git log --oneline  # Find commit hash
git reset --hard <commit-hash>
docker-compose up -d --build  # Deploy old version
```

---

## 📈 Scaling Considerations

### When to scale
- Response times > 2 seconds
- Database connections maxed out
- CPU/RAM consistently > 80%
- More than 1000 concurrent users

### Vertical scaling (bigger server)
- Upgrade to larger droplet/instance
- Double RAM and CPU
- Cost: ~$20-40/month

### Horizontal scaling (multiple servers)
- Add load balancer
- Read replicas for database
- Redis for caching
- Cost: ~$50-100/month

---

## 🎯 Cost Optimization Tips

1. **Use CDN** for static assets (Cloudflare free tier)
2. **Enable gzip** compression in Nginx
3. **Optimize images** before upload
4. **Cache API responses** with Redis
5. **Monitor database queries** (pgAnalyze free tier)
6. **Use connection pooling** (already configured)

---

## 📞 Support Resources

- **Docs**: `README.md`, `DEPLOYMENT.md`, `SUPERCOMPUTER.md`
- **Local setup**: `./setup-local.sh`
- **Quick start**: `./start.sh`
- **Deploy**: `./deploy-abacus.sh`

---

**Ready to deploy?**
1. Choose your platform
2. Run the setup script
3. Update the checklist
4. Go live! 🚀

*Built with ❤️ for sovereignty and healing.*
