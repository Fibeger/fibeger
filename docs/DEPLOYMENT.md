# Deployment Guide

Complete guide for deploying Fibeger to a Fedora server with automated CI/CD.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Detailed Setup](#detailed-setup)
5. [Deployment Checklist](#deployment-checklist)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)

## Overview

Fibeger uses a modern deployment architecture:

```
GitHub Actions (CI/CD)
    ↓ Tailscale SSH
Fedora Server (Podman)
    ↓ localhost:8080
Cloudflare Tunnel
    ↓ HTTPS
Public Internet
```

### Technology Stack

- **Container Runtime**: Podman (Docker-compatible)
- **Orchestration**: Podman Compose
- **Reverse Proxy**: Caddy 2
- **Database**: PostgreSQL 16
- **Object Storage**: MinIO (S3-compatible)
- **Tunnel**: Cloudflare Tunnel
- **Secure Access**: Tailscale SSH
- **CI/CD**: GitHub Actions

### Key Benefits

- **No open ports** - Cloudflare Tunnel eliminates port forwarding
- **Zero-trust SSH** - Tailscale for secure deployment access
- **Automated deployments** - Push to main, auto-deploy
- **DDoS protection** - Built-in Cloudflare protection
- **Free hosting** - Self-hosted on your hardware

## Prerequisites

### Required Accounts

- ✅ **Fedora server** with Podman (Fedora 38+)
- ✅ **GitHub account** with repository
- ✅ **Tailscale account** (free for personal use)
- ✅ **Cloudflare account** with domain

### Time Estimate

- **Quick setup**: 30-45 minutes
- **Full setup with testing**: 60-90 minutes

## Quick Start

For experienced users, here's the fast path:

### 1. GitHub Secrets (5 minutes)

Add three secrets at `https://github.com/YOUR_USERNAME/Fibeger/settings/secrets/actions`:

```
GHCR_PAT         - GitHub Personal Access Token (write:packages)
TAILSCALE_ID     - Tailscale OAuth Client ID
TAILSCALE_SECRET - Tailscale OAuth Client Secret
```

### 2. Server Setup (15 minutes)

```bash
# Copy and run automated setup script
scp scripts/setup-fedora-server.sh user@your-server:~/
ssh user@your-server
chmod +x setup-fedora-server.sh
./setup-fedora-server.sh

# Save the generated passwords and Tailscale IP!
```

### 3. Cloudflare Tunnel (10 minutes)

```bash
# On your server
cloudflared tunnel login
cloudflared tunnel create fibeger
# Note tunnel ID

sudo cp scripts/cloudflared-config.example.yml /etc/cloudflared/config.yml
sudo nano /etc/cloudflared/config.yml
# Replace YOUR_TUNNEL_ID and YOUR_USERNAME

cloudflared tunnel route dns fibeger fibeger.com
cloudflared tunnel route dns fibeger minio.fibeger.com

sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

### 4. Configure and Deploy (5 minutes)

```bash
# Update Tailscale IP in workflow
# Edit .github/workflows/ci-deploy.yml line 56

# Update IMAGE_REF on server
ssh user@your-server
cd /opt/fibeger
nano .env
# Set: IMAGE_REF=ghcr.io/YOUR_GITHUB_USERNAME/fibeger:latest

# Deploy!
git push origin main
```

**Continue to [Detailed Setup](#detailed-setup) for step-by-step instructions.**

## Detailed Setup

### Step 1: GitHub Configuration

#### 1.1 Create GitHub Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Configure:
   - **Note**: `GHCR Access for Fibeger`
   - **Expiration**: 90 days or 1 year
   - **Scopes**:
     - ✅ `write:packages`
     - ✅ `read:packages`
     - ✅ `delete:packages`
4. Click **"Generate token"**
5. **Copy the token immediately** (you won't see it again!)

#### 1.2 Create Tailscale OAuth Credentials

1. Go to https://login.tailscale.com/admin/settings/oauth
2. Click **"Generate OAuth client"**
3. Configure:
   - **Description**: `GitHub Actions CI/CD`
   - **Tags**: `tag:ci`
4. Click **"Generate client"**
5. **Copy both values**:
   - Client ID → `TAILSCALE_ID`
   - Client Secret → `TAILSCALE_SECRET`

**Optional but Recommended**: Configure Tailscale ACL

Add to https://login.tailscale.com/admin/acls:

```json
{
  "tagOwners": {
    "tag:ci": ["autogroup:admin"]
  },
  "acls": [
    {
      "action": "accept",
      "src": ["tag:ci"],
      "dst": ["tag:server:22"]
    }
  ]
}
```

#### 1.3 Add Secrets to GitHub Repository

1. Go to `https://github.com/YOUR_USERNAME/Fibeger/settings/secrets/actions`
2. Click **"New repository secret"** for each:

**GHCR_PAT**:
- Name: `GHCR_PAT`
- Value: GitHub Personal Access Token from step 1.1

**TAILSCALE_ID**:
- Name: `TAILSCALE_ID`
- Value: OAuth Client ID from step 1.2

**TAILSCALE_SECRET**:
- Name: `TAILSCALE_SECRET`
- Value: OAuth Client Secret from step 1.2

#### 1.4 Enable GitHub Actions

1. Go to **Settings** → **Actions** → **General**
2. Under **"Actions permissions"**:
   - ✅ Allow all actions and reusable workflows
3. Under **"Workflow permissions"**:
   - ✅ Read and write permissions
4. Click **"Save"**

---

### Step 2: Fedora Server Setup

#### 2.1 Install Required Packages

**Option A: Use Automated Script (Recommended)**

```bash
# Copy script to server
scp scripts/setup-fedora-server.sh user@your-server:~/

# SSH to server
ssh user@your-server

# Run setup
chmod +x setup-fedora-server.sh
./setup-fedora-server.sh
```

The script installs:
- Podman and podman-compose
- Git
- Cloudflared
- Tailscale
- Creates `/opt/fibeger` directory
- Generates secure `.env` file
- Shows your Tailscale IP

**⚠️ IMPORTANT: Save the passwords shown at the end!**

**Option B: Manual Installation**

```bash
# Install packages
sudo dnf install -y podman-compose git cloudflared tailscale

# Create deployment directory
sudo mkdir -p /opt/fibeger
sudo chown -R $USER:$USER /opt/fibeger

# Start Tailscale
sudo systemctl enable --now tailscaled
sudo tailscale up

# Get Tailscale IP (save this!)
tailscale ip -4
```

#### 2.2 Configure Tailscale

```bash
# Get your Tailscale IP
tailscale ip -4
# Example output: 100.119.236.64

# Test SSH access
tailscale ssh $USER@YOUR_TAILSCALE_IP
```

**Update workflow with your Tailscale IP**:

Edit `.github/workflows/ci-deploy.yml` line 56:
```yaml
SERVER_TS_HOST: 100.119.236.64  # Replace with your actual IP
```

Commit and push this change:
```bash
git add .github/workflows/ci-deploy.yml
git commit -m "Configure Tailscale IP"
git push origin main
```

#### 2.3 Create Environment File

Create `/opt/fibeger/.env`:

```bash
cd /opt/fibeger
nano .env
```

Add this content:

```env
# Admin credentials (used for DB, MinIO, pgAdmin)
ADMIN_USER=admin
ADMIN_PASSWORD=CHANGE_THIS_SECURE_PASSWORD

# NextAuth secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=CHANGE_THIS_TO_RANDOM_64_CHAR_STRING

# Public URLs
NEXTAUTH_URL=https://fibeger.com
S3_PUBLIC_URL=https://fibeger.com/minio

# Image reference (will be updated by CI/CD)
IMAGE_REF=ghcr.io/yourusername/fibeger:latest
```

**Generate secure secrets**:

```bash
# Generate NextAuth secret
openssl rand -base64 32

# Generate secure password
openssl rand -base64 24
```

**Set proper permissions**:

```bash
chmod 600 /opt/fibeger/.env
```

#### 2.4 Copy Application Files

**Option A: Clone from GitHub**

```bash
cd /opt/fibeger
git clone https://github.com/YOUR_USERNAME/Fibeger.git .
```

**Option B: Copy files manually**

```bash
scp docker-compose.yml user@your-server:/opt/fibeger/
scp Caddyfile user@your-server:/opt/fibeger/
```

---

### Step 3: Cloudflare Tunnel Setup

#### 3.1 Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser for authentication.

#### 3.2 Create Tunnel

```bash
cloudflared tunnel create fibeger
```

**Save the Tunnel ID** shown in the output!

Example output:
```
Created tunnel fibeger with id a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

#### 3.3 Configure Tunnel

Copy the example config:

```bash
sudo cp scripts/cloudflared-config.example.yml /etc/cloudflared/config.yml
sudo nano /etc/cloudflared/config.yml
```

Update these values:
```yaml
tunnel: YOUR_TUNNEL_ID_HERE
credentials-file: /home/YOUR_USERNAME/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: fibeger.com
    service: http://127.0.0.1:8080
    originRequest:
      noTLSVerify: true
  
  - hostname: minio.fibeger.com
    service: http://127.0.0.1:8080
    originRequest:
      noTLSVerify: true
  
  - service: http_status:404
```

#### 3.4 Create DNS Records

```bash
cloudflared tunnel route dns fibeger fibeger.com
cloudflared tunnel route dns fibeger minio.fibeger.com
```

#### 3.5 Install and Start Service

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared

# Verify
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -f
```

---

### Step 4: Initial Deployment

#### 4.1 Update Configuration

**On Server - Update IMAGE_REF**:

```bash
ssh user@your-server
cd /opt/fibeger
nano .env
```

Change:
```env
IMAGE_REF=ghcr.io/YOUR_GITHUB_USERNAME/fibeger:latest
```

#### 4.2 Deploy via GitHub Actions

```bash
# Push to trigger deployment
git commit --allow-empty -m "Initial deployment"
git push origin main
```

**Monitor deployment**:

1. Go to https://github.com/YOUR_USERNAME/Fibeger/actions
2. Watch the workflow run (~10 minutes total)
3. Wait for both jobs to complete:
   - ✅ Build and push (~5-7 minutes)
   - ✅ Deploy (~2-3 minutes)

#### 4.3 Initialize MinIO

After deployment completes:

**Automatic Initialization** (Recommended):

The `minio-init` container should automatically create the bucket. Verify:

```bash
ssh user@your-server
cd /opt/fibeger
podman-compose ps
# minio-init should show "Exited (0)"

podman-compose logs minio-init
# Should show "MinIO bucket fibeger created and set to public"
```

**Manual Initialization** (if needed):

```bash
# Option A: Use MinIO Console
1. Visit https://minio.fibeger.com
2. Login with ADMIN_USER and ADMIN_PASSWORD from .env
3. Click "Buckets" → "Create Bucket"
4. Name: fibeger
5. Click "Create"
6. Set bucket policy to public read

# Option B: Use MinIO Client
podman exec -it fibeger_minio_1 mc alias set myminio http://localhost:9000 $ADMIN_USER $ADMIN_PASSWORD
podman exec -it fibeger_minio_1 mc mb --ignore-existing myminio/fibeger
podman exec -it fibeger_minio_1 mc anonymous set public myminio/fibeger
```

---

### Step 5: Configure Auto-Start

Configure services to start automatically after reboot:

```bash
cd /opt/fibeger
bash scripts/ensure-services-on-boot.sh
```

This configures:
- ✅ Tailscale to start on boot
- ✅ Cloudflared to start on boot
- ✅ User lingering (critical for rootless Podman)
- ✅ Systemd service for containers

**See [OPERATIONS.md](OPERATIONS.md) for detailed operations documentation.**

---

## Deployment Checklist

Use this checklist to verify your deployment:

### Pre-Deployment

#### GitHub Configuration
- [ ] GitHub Actions enabled
- [ ] Secrets configured:
  - [ ] `GHCR_PAT`
  - [ ] `TAILSCALE_ID`
  - [ ] `TAILSCALE_SECRET`

#### Tailscale Configuration
- [ ] Tailscale installed and running
- [ ] Tailscale IP noted
- [ ] Tailscale IP updated in workflow
- [ ] Tailscale SSH tested

#### Cloudflare Configuration
- [ ] Domain added to Cloudflare
- [ ] Tunnel created and ID noted
- [ ] Config file created
- [ ] DNS records created
- [ ] Cloudflared service running

#### Server Setup
- [ ] Podman installed
- [ ] Podman-compose installed
- [ ] Directory `/opt/fibeger` created
- [ ] `.env` file created with secure passwords
- [ ] Permissions set: `chmod 600 .env`
- [ ] Application files copied/cloned

### Deployment

- [ ] Pushed to main branch
- [ ] GitHub Actions workflow triggered
- [ ] Build job completed successfully
- [ ] Deploy job completed successfully
- [ ] All containers running:
  - [ ] db (PostgreSQL)
  - [ ] minio (MinIO)
  - [ ] pgadmin (pgAdmin)
  - [ ] app (Next.js)
  - [ ] caddy (Caddy)

### MinIO Configuration

- [ ] MinIO console accessible
- [ ] Bucket `fibeger` exists
- [ ] Bucket policy set to public read
- [ ] Test file upload successful

### Verification

- [ ] Website accessible: https://fibeger.com
- [ ] No certificate errors
- [ ] Can create account / login
- [ ] Can upload files
- [ ] MinIO console accessible: https://minio.fibeger.com

### Auto-Start Configuration

- [ ] Run `ensure-services-on-boot.sh`
- [ ] User lingering enabled
- [ ] fibeger-stack service enabled
- [ ] Tailscale enabled
- [ ] Cloudflared enabled

### Reboot Test

- [ ] Test reboot completed
- [ ] All services started automatically
- [ ] Website accessible after reboot
- [ ] GitHub Actions can deploy after reboot

---

## Verification

### Check Container Status

```bash
ssh user@your-server
cd /opt/fibeger
podman-compose ps
```

Expected output:
```
NAME                   STATUS      PORTS
fibeger_db_1          Up          5432/tcp
fibeger_minio_1       Up          9000-9001/tcp
fibeger_pgadmin_1     Up          80/tcp
fibeger_app_1         Up          3000/tcp
fibeger_caddy_1       Up          0.0.0.0:8080->80/tcp
```

### Check Logs

```bash
# All services
podman-compose logs -f

# Specific service
podman-compose logs -f app
podman-compose logs -f caddy
podman-compose logs -f db
```

### Test Endpoints

```bash
# Test local Caddy
curl -H "Host: fibeger.com" http://127.0.0.1:8080

# Test via Cloudflare Tunnel
curl -I https://fibeger.com

# Test MinIO
curl -I https://minio.fibeger.com
```

### Access Your App

- **Main app**: https://fibeger.com
- **MinIO Console**: https://minio.fibeger.com

### Verify Deployment Flow

```bash
# Make a small change
echo "# Test" >> README.md
git add README.md
git commit -m "Test deployment"
git push origin main

# Watch GitHub Actions
# Visit: https://github.com/YOUR_USERNAME/Fibeger/actions
```

---

## Troubleshooting

### GitHub Actions Failures

#### Build Job Fails

**Symptoms**: Docker build fails, dependency errors

**Solutions**:

```bash
# Check Dockerfile
# Check package.json dependencies
# Check build logs in Actions tab

# Test build locally
docker build -t test .
```

#### Deploy Job Fails - Tailscale Connection

**Symptoms**: Can't connect to server via Tailscale

**Solutions**:

```bash
# On server, check Tailscale status
tailscale status

# Restart Tailscale
sudo systemctl restart tailscaled
sudo tailscale up

# Test SSH manually
tailscale ssh $USER@YOUR_TAILSCALE_IP

# Check Tailscale ACLs
# Visit: https://login.tailscale.com/admin/acls

# Verify secrets in GitHub
# Settings → Secrets → Ensure TAILSCALE_ID and TAILSCALE_SECRET exist
```

#### Deploy Job Fails - Podman Errors

**Symptoms**: `podman-compose: command not found`

**Solutions**:

```bash
# Install podman-compose
sudo dnf install -y podman-compose

# Or run setup script
bash scripts/setup-fedora-server.sh
```

---

### Container Issues

#### Containers Not Starting

**Check status**:

```bash
cd /opt/fibeger
podman-compose ps
podman-compose logs -f
```

**Common fixes**:

```bash
# Restart containers
podman-compose restart

# Full restart
podman-compose down
podman-compose up -d

# Check environment variables
cat .env

# Check permissions
ls -la .env  # Should show -rw------- (600)
chmod 600 .env

# Pull latest images
podman-compose pull
podman-compose up -d
```

#### Database Connection Errors

**Symptoms**: App can't connect to PostgreSQL

**Solutions**:

```bash
# Check database container
podman-compose ps db
podman-compose logs db

# Check health
podman exec fibeger_db_1 pg_isready -U admin -d fibeger

# Verify DATABASE_URL
podman exec fibeger_app_1 env | grep DATABASE_URL

# Restart database and app
podman-compose restart db app
```

---

### Cloudflare Tunnel Issues

#### Website Not Loading

**Symptoms**: https://fibeger.com doesn't load

**Solutions**:

```bash
# Check Cloudflared status
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -f

# Common errors and fixes:

# 1. "dial tcp: connection refused"
#    → Caddy isn't running
podman-compose ps caddy
podman-compose restart caddy

# 2. "authentication failed"
#    → Credentials issue
sudo cat /etc/cloudflared/config.yml
# Verify tunnel ID and credentials path

# 3. "no such host"
#    → DNS not configured
cloudflared tunnel route dns fibeger fibeger.com

# Restart tunnel
sudo systemctl restart cloudflared

# Test local endpoint
curl -H "Host: fibeger.com" http://127.0.0.1:8080
# If this works, issue is with Cloudflare Tunnel
# If this fails, issue is with Caddy or app
```

#### DNS Issues

**Symptoms**: DNS records not resolving

**Solutions**:

```bash
# Check DNS records
nslookup fibeger.com
nslookup minio.fibeger.com

# Recreate DNS records
cloudflared tunnel route dns fibeger fibeger.com
cloudflared tunnel route dns fibeger minio.fibeger.com

# Check Cloudflare dashboard
# Visit: https://dash.cloudflare.com
# Ensure DNS records exist and point to tunnel
```

---

### MinIO / File Upload Issues

#### Upload Fails with 500 Error

**Quick Fix**:

```bash
# Get credentials from .env
cd /opt/fibeger
source .env

# Create bucket and set policy
podman exec fibeger_minio_1 mc alias set myminio http://localhost:9000 $ADMIN_USER $ADMIN_PASSWORD
podman exec fibeger_minio_1 mc mb --ignore-existing myminio/fibeger
podman exec fibeger_minio_1 mc anonymous set public myminio/fibeger

# Verify
podman exec fibeger_minio_1 mc ls myminio/
podman exec fibeger_minio_1 mc anonymous get myminio/fibeger
```

#### MinIO Not Accessible

**Check connectivity from app**:

```bash
podman exec fibeger_app_1 curl -v http://minio:9000/minio/health/live
# Should return HTTP 200 OK
```

**Check environment variables**:

```bash
podman exec fibeger_app_1 env | grep S3
```

Should show:
```
S3_ENDPOINT=http://minio:9000
S3_PUBLIC_URL=https://fibeger.com/minio
S3_BUCKET=fibeger
S3_ACCESS_KEY_ID=admin
S3_SECRET_ACCESS_KEY=<password>
S3_USE_TLS=false
```

**Restart services**:

```bash
podman-compose restart minio app
```

---

### Permission Issues

**Fix deployment directory ownership**:

```bash
sudo chown -R $USER:$USER /opt/fibeger
```

**Fix .env permissions**:

```bash
chmod 600 /opt/fibeger/.env
```

**Enable user lingering** (for rootless Podman):

```bash
sudo loginctl enable-linger $USER

# Verify
loginctl show-user $USER | grep Linger
# Should show: Linger=yes
```

---

### SELinux Issues

If SELinux is enabled and causing issues:

```bash
# Check SELinux status
getenforce

# Temporarily disable for testing
sudo setenforce 0

# Re-enable
sudo setenforce 1

# If needed, configure proper contexts
# (Consult Podman and SELinux documentation)
```

---

## Advanced Topics

### Manual Deployment

If CI/CD isn't working, deploy manually:

```bash
# SSH to server
ssh user@your-server
cd /opt/fibeger

# Login to GHCR
echo $GHCR_PAT | podman login ghcr.io -u YOUR_USERNAME --password-stdin

# Pull latest image
export IMAGE_REF=ghcr.io/YOUR_USERNAME/fibeger:latest
podman pull $IMAGE_REF

# Update .env
sed -i "s|^IMAGE_REF=.*|IMAGE_REF=$IMAGE_REF|" .env

# Restart with new image
podman-compose up -d
```

### Database Backup

```bash
# Backup
podman exec fibeger_db_1 pg_dump -U admin fibeger > backup-$(date +%Y%m%d).sql

# Restore
podman exec -i fibeger_db_1 psql -U admin fibeger < backup-20260222.sql
```

### View All Logs

```bash
# System services
sudo journalctl -u tailscaled -f
sudo journalctl -u cloudflared -f

# User services
journalctl --user -u fibeger-stack.service -f

# Containers
cd /opt/fibeger
podman-compose logs -f
```

---

## Maintenance

### Update System Packages

```bash
sudo dnf update -y
```

### Clean Up Old Images

```bash
# Remove unused images
podman image prune -a

# Remove old containers
podman container prune
```

### Monitor Disk Usage

```bash
# Check disk space
df -h /opt/fibeger
df -h /var/lib/containers

# Check container volumes
podman volume ls
podman volume inspect fibeger_db_data
```

---

## Resources

- **GitHub Actions**: https://docs.github.com/en/actions
- **Tailscale SSH**: https://tailscale.com/kb/1193/tailscale-ssh
- **Cloudflare Tunnel**: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps
- **Podman Compose**: https://github.com/containers/podman-compose
- **MinIO Documentation**: https://min.io/docs/minio/linux/index.html

---

## Next Steps

After successful deployment:

1. **Configure Auto-Start**: See [OPERATIONS.md](OPERATIONS.md)
2. **Set Up Monitoring**: Run `scripts/setup-monitoring.sh`
3. **Test Reboot**: Ensure services restart automatically
4. **Configure Backups**: Set up automated database backups
5. **Security Hardening**: Review and update security settings

---

**Deployment complete! 🎉 Your Fibeger instance should now be live at https://fibeger.com**
