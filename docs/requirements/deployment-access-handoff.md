# Tea-Tax Deployment Reference

This document is a reference for deployment access and operational requirements for the current DigitalOcean environments.

## Current Hosts

- `tea-tax-dev` - `45.55.245.222`
- `tea-tax-demo` - `174.138.67.171`
- SSH user: `deploy`
- SSH auth: key only

## What To Share

Share these items:

- host IPs
- SSH username (`deploy`)
- deployment commands and process
- branch and environment conventions (what goes to dev vs demo)

Do not share:

- your DigitalOcean login
- your private SSH key file (`~/.ssh/tea-tax-do_ed25519`)
- any `.env` secrets over chat without a secure secret manager

## Access Onboarding Requirements

For any new deployer, collect:

- their public SSH key (`.pub`)
- their current public IPv4 address (for firewall SSH allowlist)

A deployer can generate and copy a key with:

```bash
ssh-keygen -t ed25519 -C "tea-tax-deployer"
cat ~/.ssh/id_ed25519.pub
```

## Why DO Credentials Are Not Required

For normal deploys, only SSH access to the droplets is required.

DigitalOcean account access is only required for infrastructure changes, such as:

- creating or resizing droplets
- changing firewall rules
- managing DNS, load balancers, or managed databases
- billing and account administration

## Basic Deploy Flow

Connect:

```bash
ssh -i ~/.ssh/<deployer-key> deploy@45.55.245.222
ssh -i ~/.ssh/<deployer-key> deploy@174.138.67.171
```

Check runtime:

```bash
docker ps
docker compose version
```

Deploy app (example):

```bash
git pull
docker compose up -d --build
```

Verify:

```bash
curl http://45.55.245.222
curl http://174.138.67.171
```

## Optional Multi-User Access Model

If someone needs to manage cloud infrastructure too, invite them to the DigitalOcean account with least privilege needed instead of sharing personal credentials.
