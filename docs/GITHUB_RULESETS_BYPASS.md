# GitHub Rulesets 绕过配置指南

本文档说明如何配置 GitHub Rulesets，使 CI/CD 工作流能够直接推送版本更新到 master 分支。

## 问题描述

当仓库启用了 GitHub Rulesets 强制要求通过 PR 合并代码时，GitHub Actions 工作流无法直接推送版本更新提交到 master 分支，导致自动发布流程失败。

## 解决方案

### 方案 1: 配置 PAT Token 绕过权限（推荐）

#### 步骤 1: 创建具有绕过权限的 PAT Token

1. 访问 GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. 点击 "Generate new token"
3. 配置 Token：
   - **Token name**: `SWITCH_CC_RELEASE_TOKEN`
   - **Expiration**: 建议设置 90 天或自定义
   - **Repository access**: 选择 "Only select repositories" → 选择 `switch-cc`
   - **Permissions**:
     - Repository permissions:
       - **Contents**: Read and write (必需)
       - **Metadata**: Read-only (自动)
       - **Pull requests**: Read and write (可选)
       - **Workflows**: Read and write (必需)
   - **Organization permissions** (如果是组织仓库):
     - **Administration**: Read and write (用于绕过 rulesets)

4. 点击 "Generate token" 并复制生成的 token

#### 步骤 2: 添加 Token 到仓库 Secrets

1. 进入仓库的 Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. 配置：
   - **Name**: `PAT_TOKEN`
   - **Secret**: 粘贴刚才复制的 token
4. 点击 "Add secret"

### 方案 2: 在 Rulesets 中配置 Bypass（推荐用于组织仓库）

#### 步骤 1: 修改 Rulesets 配置

1. 进入仓库的 Settings → Rules → Rulesets
2. 找到应用于 master 分支的 ruleset，点击编辑
3. 在 "Bypass list" 部分，添加以下例外：
   
   **选项 A: 允许特定 Actor 绕过**
   - 点击 "Add bypass"
   - 选择 "Repository role" → "Maintain" 或 "Admin"
   - 或选择 "Organization role"（如果是组织仓库）

   **选项 B: 允许 GitHub Apps 绕过**
   - 点击 "Add bypass"
   - 选择 "GitHub App" → "GitHub Actions"

#### 步骤 2: 更新工作流权限

确保工作流文件中包含以下权限配置（已在当前工作流中配置）：

```yaml
permissions:
  contents: write    # 允许创建 releases 和推送到仓库
```

### 方案 3: 使用 Deploy Keys（高级选项）

如果上述方案都不适用，可以使用 Deploy Keys：

1. 生成 SSH 密钥对：
   ```bash
   ssh-keygen -t ed25519 -C "github-actions@switch-cc" -f deploy_key
   ```

2. 添加公钥到仓库的 Deploy Keys（Settings → Deploy keys）：
   - Title: `CI Deploy Key`
   - Key: 粘贴 `deploy_key.pub` 内容
   - ✅ 勾选 "Allow write access"

3. 添加私钥到仓库 Secrets（Settings → Secrets）：
   - Name: `DEPLOY_KEY`
   - Secret: 粘贴 `deploy_key` 内容

4. 修改工作流的 checkout 步骤：
   ```yaml
   - name: Checkout repository
     uses: actions/checkout@v4
     with:
       ssh-key: ${{ secrets.DEPLOY_KEY }}
       fetch-depth: 0
   ```

## 验证配置

### 测试 PAT Token

在本地测试 PAT token 是否有足够权限：

```bash
# 使用 PAT token clone 仓库
git clone https://YOUR_PAT_TOKEN@github.com/edisonLzy/switch-cc.git test-clone
cd test-clone

# 尝试推送到 master
git commit --allow-empty -m "test: verify PAT token permissions"
git push origin master
```

### 查看工作流日志

触发工作流后，检查 "Commit version bump" 步骤的日志：

- ✅ 成功：应该看到 `推送版本更新到 master 分支...` 和推送成功的消息
- ❌ 失败：会显示权限错误，需要检查上述配置

## 安全建议

1. **使用 Fine-grained PAT**：相比 Classic PAT，Fine-grained PAT 权限更精确、更安全
2. **最小权限原则**：只授予必需的权限
3. **定期轮换 Token**：建议每 90 天更新一次 PAT token
4. **监控 Token 使用**：定期检查 Settings → Developer settings → Personal access tokens 中的 token 使用记录
5. **限制 Token 范围**：只授予特定仓库访问权限

## 当前工作流配置

当前 `release.yml` 工作流已配置：

1. ✅ 在 checkout 步骤使用 `PAT_TOKEN`（支持 fallback 到 `GITHUB_TOKEN`）
2. ✅ 在 commit 步骤使用 `PAT_TOKEN`
3. ✅ 使用标准的 GitHub Actions bot 身份提交
4. ✅ 提交消息包含 `[skip ci]` 避免触发循环构建

## 故障排查

### 错误 1: "refusing to allow a Personal Access Token to create or update workflow"

**原因**: PAT token 缺少 `workflow` 权限

**解决**: 重新生成 PAT token，确保勾选 "Workflows: Read and write"

### 错误 2: "Resource not accessible by integration"

**原因**: `GITHUB_TOKEN` 权限不足（默认 token 无法绕过 rulesets）

**解决**: 确保使用 `PAT_TOKEN` 而不是 `GITHUB_TOKEN`

### 错误 3: "protected branch update failed for refs/heads/master"

**原因**: Rulesets 阻止了直接推送

**解决**: 
- 确保 PAT token 具有管理员权限
- 或在 Rulesets 中添加 bypass 配置

## 相关文档

- [GitHub Actions 权限文档](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)
- [GitHub Rulesets 文档](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets)
- [Fine-grained PAT 文档](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-fine-grained-personal-access-token)

