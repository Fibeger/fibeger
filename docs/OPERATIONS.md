# Operations Guide

Complete guide for managing and maintaining your Fibeger deployment.

## Table of Contents

1. [Overview](#overview)
2. [Auto-Start Configuration](#auto-start-configuration)
3. [Reboot Resilience](#reboot-resilience)
4. [Service Management](#service-management)
5. [Monitoring](#monitoring)
6. [Maintenance](#maintenance)
7. [Troubleshooting](#troubleshooting)
8. [Quick Reference](#quick-reference)

## Overview

This guide covers day-to-day operations for your Fibeger server, including:

- Configuring services to start automatically after reboot
- Monitoring system health
- Managing containers and services
- Regular maintenance procedures
- Emergency recovery procedures

### Components to Manage

```
System Level (root/sudo):
├─ tailscaled     → Tailscale daemon for SSH access
└─ cloudflared    → Cloudflare Tunnel for public access

User Level (rootless):
├─ podman.socket  → Podman API socket
└─ fibeger-stack  → Systemd service managing all containers

Containers (via Podman Compose):
├─ db             → PostgreSQL database
├─ minio          → MinIO object storage
├─ pgadmin        → Database admin interface
├─ app            → Next.js application
└─ caddy          → Reverse proxy
```

## Auto-Start Configuration

### One-Time Setup

Run this script once to configure all services to start on boot:

```bash
cd /opt/fibeger
bash scripts/ensure-services-on-boot.sh
```

This script will:
- ✅ Enable Tailscale to start on boot
- ✅ Enable Cloudflared to start on boot
- ✅ Enable user lingering (critical for rootless Podman)
- ✅ Create and enable systemd service for containers
- ✅ Configure Podman socket

### Manual Configuration

If you prefer to configure manually or need to fix a specific component:

#### 1. Enable Tailscale

```bash
sudo systemctl enable tailscaled
sudo systemctl start tailscaled

# Verify
systemctl is-enabled tailscaled  # Should show: enabled
tailscale status                  # Should show connected
```

#### 2. Enable Cloudflared

```bash
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# Verify
systemctl is-enabled cloudflared  # Should show: enabled
sudo systemctl status cloudflared # Should show: active (running)
```

#### 3. Enable User Lingering (Critical!)

**This is the most important step** - without it, containers stop when you log out.

```bash
sudo loginctl enable-linger $USER

# Verify
loginctl show-user $USER | grep Linger
# Should show: Linger=yes
```

#### 4. Create Fibeger Stack Service

Create `~/.config/systemd/user/fibeger-stack.service`:

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/fibeger-stack.service << 'EOF'
[Unit]
Description=Fibeger Podman Compose Stack
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/fibeger
ExecStart=/usr/bin/podman-compose up -d
ExecStop=/usr/bin/podman-compose down
TimeoutStartSec=300

[Install]
WantedBy=default.target
EOF
```

Enable and start:

```bash
systemctl --user daemon-reload
systemctl --user enable fibeger-stack.service
systemctl --user start fibeger-stack.service

# Verify
systemctl --user status fibeger-stack.service
```

#### 5. Enable Podman Socket

```bash
systemctl --user enable podman.socket
systemctl --user start podman.socket

# Verify
systemctl --user status podman.socket
```

### Verification

Check that everything is configured correctly:

```bash
# User lingering
loginctl show-user $USER | grep Linger=yes

# System services
systemctl is-enabled tailscaled      # enabled
systemctl is-enabled cloudflared     # enabled

# User services
systemctl --user is-enabled fibeger-stack.service  # enabled
systemctl --user is-enabled podman.socket          # enabled

# All services active
systemctl is-active tailscaled cloudflared
systemctl --user is-active fibeger-stack.service podman.socket
```

## Reboot Resilience

### Testing Auto-Start

#### Pre-Reboot Checklist

Before rebooting, verify current state:

```bash
# Run verification script
bash /opt/fibeger/scripts/verify-after-reboot.sh

# Ensure all services are enabled (see Verification section above)
```

#### Perform Reboot

```bash
sudo reboot
```

#### Post-Reboot Verification

Wait 2-3 minutes after reboot, then:

```bash
# SSH back into server
ssh user@your-server

# Run verification script
bash /opt/fibeger/scripts/verify-after-reboot.sh

# Should show all services running
```

### Boot Sequence Timeline

Understanding the boot process helps with troubleshooting:

```
Time   Event
────   ─────
00:00  Server boots
00:30  System services start (tailscaled, cloudflared)
01:00  User lingering activates user services
01:00  Podman socket starts
01:30  Fibeger-stack service starts containers
02:00  Containers complete startup
02:00  Health checks pass
02:30  Cloudflare Tunnel establishes connection
03:00  Website fully operational ✓
```

**Expected total time**: 2-3 minutes from boot to fully operational

### Critical Requirements

For auto-start to work, these must all be true:

```bash
# 1. User lingering enabled
loginctl show-user $USER | grep Linger=yes

# 2. System services enabled
systemctl is-enabled tailscaled      # enabled
systemctl is-enabled cloudflared     # enabled

# 3. User services enabled
systemctl --user is-enabled fibeger-stack.service  # enabled

# 4. Containers have restart policy
# Check docker-compose.yml: all services should have "restart: unless-stopped"
```

## Service Management

### System Services

#### Tailscale

```bash
# Status
sudo systemctl status tailscaled
tailscale status

# Start/Stop/Restart
sudo systemctl start tailscaled
sudo systemctl stop tailscaled
sudo systemctl restart tailscaled

# Logs
sudo journalctl -u tailscaled -f

# Reconnect
sudo tailscale up
```

#### Cloudflared

```bash
# Status
sudo systemctl status cloudflared

# Start/Stop/Restart
sudo systemctl start cloudflared
sudo systemctl stop cloudflared
sudo systemctl restart cloudflared

# Logs
sudo journalctl -u cloudflared -f
sudo journalctl -u cloudflared -n 50
```

### User Services

#### Fibeger Stack

```bash
# Status
systemctl --user status fibeger-stack.service

# Start/Stop/Restart
systemctl --user start fibeger-stack.service
systemctl --user stop fibeger-stack.service
systemctl --user restart fibeger-stack.service

# Logs
journalctl --user -u fibeger-stack.service -f
journalctl --user -u fibeger-stack.service -n 50
```

#### Podman Socket

```bash
# Status
systemctl --user status podman.socket

# Restart
systemctl --user restart podman.socket
```

### Container Management

#### Via Podman Compose

```bash
cd /opt/fibeger

# View status
podman-compose ps

# View logs
podman-compose logs -f
podman-compose logs -f app          # Specific container
podman-compose logs --tail=50 app   # Last 50 lines

# Restart containers
podman-compose restart
podman-compose restart app          # Specific container

# Stop/Start
podman-compose stop
podman-compose start
podman-compose up -d

# Full restart
podman-compose down
podman-compose up -d

# Recreate containers
podman-compose up -d --force-recreate
```

#### Via Podman Directly

```bash
# List containers
podman ps
podman ps -a  # Include stopped

# View logs
podman logs fibeger_app_1 -f
podman logs --tail=50 fibeger_app_1

# Execute commands
podman exec -it fibeger_app_1 bash
podman exec -it fibeger_db_1 psql -U admin fibeger

# Restart container
podman restart fibeger_app_1

# Stop/Start
podman stop fibeger_app_1
podman start fibeger_app_1

# Remove and recreate
podman stop fibeger_app_1
podman rm fibeger_app_1
cd /opt/fibeger && podman-compose up -d app
```

## Monitoring

### Health Check Script

Run the comprehensive health check:

```bash
bash /opt/fibeger/scripts/verify-after-reboot.sh
```

This checks:
- Tailscale status and connection
- Cloudflared status and tunnel
- User lingering
- Container status
- Health checks
- Local connectivity
- External access

### Automated Monitoring

Set up automated health checks with recovery:

```bash
cd /opt/fibeger
bash scripts/setup-monitoring.sh
```

Choose monitoring frequency:
- **Production**: Every 5 minutes (recommended)
- **Low-traffic**: Every 15 minutes
- **Development**: Every hour

The script will:
- Run health checks automatically
- Restart failed services
- Keep logs of all checks
- Optional email alerts

#### View Monitoring Status

```bash
# If using systemd timer
systemctl --user status fibeger-monitor.timer
systemctl --user list-timers

# If using cron
crontab -l

# View logs
ls -lh /var/log/fibeger/
cat /var/log/fibeger/failures.log
cat /var/log/fibeger/recoveries.log
```

### Manual Health Checks

#### Quick Status Overview

```bash
# All system services
systemctl is-active tailscaled cloudflared

# All user services
systemctl --user is-active fibeger-stack.service podman.socket

# All containers
cd /opt/fibeger
podman-compose ps --format '{{.Service}}\t{{.Status}}'

# Website accessibility
curl -I https://your-domain.com
```

#### Detailed Checks

```bash
# Check Tailscale connection
tailscale status
tailscale ip -4

# Check Cloudflare Tunnel
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -n 20

# Check containers
cd /opt/fibeger
podman-compose ps
podman-compose logs --tail=20

# Check local Caddy
curl -H "Host: your-domain.com" http://127.0.0.1:8080

# Check database
podman exec fibeger_db_1 pg_isready -U admin -d fibeger

# Check MinIO
podman exec fibeger_minio_1 mc admin info myminio 2>/dev/null || echo "MinIO check skipped"
```

### Monitoring Logs

```bash
# Tail all container logs
cd /opt/fibeger && podman-compose logs -f

# Tail specific container
podman-compose logs -f app

# Tail system services
sudo journalctl -u cloudflared -f
sudo journalctl -u tailscaled -f

# Tail user services
journalctl --user -u fibeger-stack.service -f

# View boot logs
sudo journalctl -b -n 100

# View logs since specific time
sudo journalctl -u cloudflared --since "10 minutes ago"
journalctl --user -u fibeger-stack.service --since "1 hour ago"
```

## Maintenance

### Regular Maintenance Tasks

#### Daily
- Check health status
- Review logs for errors

#### Weekly
- Check disk space
- Review Cloudflare analytics
- Check for failed login attempts

#### Monthly
- Update system packages
- Clean up old container images
- Test reboot procedure
- Review and rotate secrets

### Update System Packages

```bash
# Update all packages
sudo dnf update -y

# Update specific packages
sudo dnf update cloudflared tailscale

# Check for updates
sudo dnf check-update
```

### Clean Up Old Images

```bash
# Remove unused images
podman image prune -a

# Remove old containers
podman container prune

# Remove unused volumes
podman volume prune

# Check disk usage
df -h /var/lib/containers
podman system df
```

### Database Maintenance

#### Backup Database

```bash
# Create backup
podman exec fibeger_db_1 pg_dump -U admin fibeger > backup-$(date +%Y%m%d).sql

# Create compressed backup
podman exec fibeger_db_1 pg_dump -U admin fibeger | gzip > backup-$(date +%Y%m%d).sql.gz

# Store in safe location
mkdir -p ~/backups
mv backup-$(date +%Y%m%d).sql.gz ~/backups/
```

#### Restore Database

```bash
# Restore from backup
podman exec -i fibeger_db_1 psql -U admin fibeger < backup-20260222.sql

# Restore from compressed backup
gunzip -c backup-20260222.sql.gz | podman exec -i fibeger_db_1 psql -U admin fibeger
```

#### Database Statistics

```bash
# Connect to database
podman exec -it fibeger_db_1 psql -U admin fibeger

# Inside psql:
# Check database size
\l+

# Check table sizes
\dt+

# Check connections
SELECT * FROM pg_stat_activity;

# Exit
\q
```

### MinIO Maintenance

```bash
# Check MinIO status
podman exec fibeger_minio_1 mc admin info myminio

# List buckets
podman exec fibeger_minio_1 mc ls myminio/

# Check bucket size
podman exec fibeger_minio_1 mc du myminio/fibeger
```

### Log Rotation

Logs are automatically rotated by journald, but you can adjust:

```bash
# Check journald config
sudo nano /etc/systemd/journald.conf

# Common settings:
# SystemMaxUse=500M
# RuntimeMaxUse=100M
# MaxRetentionSec=1month

# Apply changes
sudo systemctl restart systemd-journald
```

### Security Updates

```bash
# Check for security updates
sudo dnf check-update --security

# Install security updates only
sudo dnf update --security -y

# Enable automatic security updates (optional)
sudo dnf install -y dnf-automatic
sudo systemctl enable --now dnf-automatic.timer
```

## Troubleshooting

### Containers Not Starting After Reboot

#### Check User Lingering

```bash
loginctl show-user $USER | grep Linger

# If not enabled:
sudo loginctl enable-linger $USER
```

#### Check Service Status

```bash
systemctl --user status fibeger-stack.service
journalctl --user -u fibeger-stack.service -n 50
```

#### Manual Start

```bash
cd /opt/fibeger
podman-compose up -d
podman-compose ps
podman-compose logs -f
```

### Tailscale Not Connected

```bash
# Check status
sudo systemctl status tailscaled
tailscale status

# Restart
sudo systemctl restart tailscaled
sudo tailscale up

# Check logs
sudo journalctl -u tailscaled -n 50
```

### Cloudflare Tunnel Not Working

```bash
# Check status
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -n 50

# Common errors:

# 1. "dial tcp: connection refused"
#    → Caddy not running
podman-compose ps caddy
podman-compose restart caddy

# 2. "authentication failed"
#    → Check credentials
sudo cat /etc/cloudflared/config.yml
# Verify tunnel ID and credentials path

# 3. Tunnel not establishing
#    → Restart
sudo systemctl restart cloudflared
# Wait 1-2 minutes
sudo journalctl -u cloudflared -f
```

### Website Not Accessible

#### Troubleshooting Flow

```
1. Can you curl localhost:8080?
   curl -H "Host: your-domain.com" http://127.0.0.1:8080
   
   NO → Check Caddy and app containers
        podman-compose ps
        podman-compose logs caddy
        podman-compose logs app
   
   YES → Continue to step 2

2. Is Cloudflare Tunnel running?
   sudo systemctl status cloudflared
   
   NO → Restart cloudflared
        sudo systemctl restart cloudflared
   
   YES → Continue to step 3

3. Can you access the public domain?
   curl -I https://your-domain.com
   
   NO → Check DNS and wait 1-2 minutes
        nslookup your-domain.com
   
   YES → Working!
```

### Database Connection Errors

```bash
# Check database container
podman-compose ps db
podman-compose logs db

# Test connection
podman exec fibeger_db_1 pg_isready -U admin -d fibeger

# Check database is accepting connections
podman exec -it fibeger_db_1 psql -U admin fibeger -c "SELECT version();"

# Restart database
podman-compose restart db

# Wait for health check
sleep 10
podman-compose ps db
```

### High Disk Usage

```bash
# Check disk space
df -h
df -h /var/lib/containers

# Check container usage
podman system df

# Clean up
podman image prune -a -f
podman container prune -f
podman volume prune -f

# Clean up journal logs
sudo journalctl --vacuum-time=7d
sudo journalctl --vacuum-size=500M

# Check database size
podman exec -it fibeger_db_1 psql -U admin fibeger -c "\l+"
```

### Emergency Recovery

If everything fails, manually restart all services:

```bash
# 1. Restart system services
sudo systemctl restart tailscaled
sudo systemctl restart cloudflared

# 2. Stop all containers
cd /opt/fibeger
podman-compose down

# 3. Start all containers
podman-compose up -d

# 4. Wait for startup
sleep 30

# 5. Check status
podman-compose ps
bash scripts/verify-after-reboot.sh

# 6. Check website
curl -I https://your-domain.com
```

## Quick Reference

### Essential Commands

#### Health Check
```bash
bash /opt/fibeger/scripts/verify-after-reboot.sh
```

#### Service Status
```bash
# System services
sudo systemctl status tailscaled cloudflared

# User services
systemctl --user status fibeger-stack.service

# Containers
cd /opt/fibeger && podman-compose ps
```

#### Restart Everything
```bash
# System services
sudo systemctl restart tailscaled cloudflared

# User service
systemctl --user restart fibeger-stack.service

# Or directly with podman-compose
cd /opt/fibeger && podman-compose restart
```

#### View Logs
```bash
# All containers
cd /opt/fibeger && podman-compose logs -f

# Specific container
podman-compose logs -f app

# System service
sudo journalctl -u cloudflared -f

# User service
journalctl --user -u fibeger-stack.service -f
```

### One-Time Setup
```bash
# Configure auto-start
cd /opt/fibeger
bash scripts/ensure-services-on-boot.sh

# Set up monitoring
bash scripts/setup-monitoring.sh
```

### Testing
```bash
# Test reboot
sudo reboot
# Wait 2-3 minutes, then:
bash /opt/fibeger/scripts/verify-after-reboot.sh

# Test website
curl -I https://your-domain.com

# Test deployment
git push origin main
```

### Backup and Restore
```bash
# Backup database
podman exec fibeger_db_1 pg_dump -U admin fibeger > backup-$(date +%Y%m%d).sql

# Restore database
podman exec -i fibeger_db_1 psql -U admin fibeger < backup-20260222.sql
```

### Critical Checks
```bash
# User lingering (MUST be yes)
loginctl show-user $USER | grep Linger

# Services enabled
systemctl is-enabled tailscaled cloudflared
systemctl --user is-enabled fibeger-stack.service

# Services active
systemctl is-active tailscaled cloudflared
systemctl --user is-active fibeger-stack.service
```

## Additional Resources

- **Deployment Guide**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Architecture Documentation**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Development Setup**: [DEVELOPMENT.md](DEVELOPMENT.md)
- **Scripts Reference**: [../scripts/README.md](../scripts/README.md)

---

**Pro Tips**:

1. **Regular Testing**: Test reboot monthly to catch issues early
2. **Automated Monitoring**: Set up the monitoring script for peace of mind
3. **Backup Strategy**: Automate database backups with a cron job
4. **Log Review**: Regularly check logs for warnings or errors
5. **Documentation**: Keep notes on any customizations to the setup

---

**Your Fibeger deployment is now fully configured for reliable operation! 🎉**
