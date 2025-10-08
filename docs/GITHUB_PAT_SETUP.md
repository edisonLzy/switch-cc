# GitHub Personal Access Token (PAT) 配置指南

## 问题说明

GitHub Actions 默认的 `GITHUB_TOKEN` 无法绕过分支保护规则（Branch Protection Rules），导致 workflow 无法推送版本更新回 master 分支。

## 解决方案

使用 Personal Access Token (PAT) 来替代默认的 `GITHUB_TOKEN`，PAT 具有更高的权限可以绕过分支保护规则。

## 配置步骤

### 1. 创建 Personal Access Token

1. 访问 GitHub Settings：https://github.com/settings/tokens
2. 点击 **"Generate new token"** → 选择 **"Generate new token (classic)"**
3. 配置 Token：
   - **Note**: 填写描述，例如 `switch-cc-release-workflow`
   - **Expiration**: 建议选择 `No expiration` 或根据需求设置
   - **Select scopes**: 勾选以下权限：
     - ✅ `repo` (完整的仓库访问权限)
     - ✅ `workflow` (更新 GitHub Actions workflows)
4. 点击页面底部的 **"Generate token"** 按钮
5. **重要**: 复制生成的 Token（形如 `ghp_xxxxxxxxxxxx`），此 Token 只会显示一次

### 2. 添加 Secret 到仓库

1. 进入仓库的 Settings 页面：
   ```
   https://github.com/edisonLzy/switch-cc/settings/secrets/actions
   ```

2. 点击 **"New repository secret"** 按钮

3. 填写信息：
   - **Name**: `PAT_TOKEN`（必须是这个名称，与 workflow 中的配置对应）
   - **Secret**: 粘贴刚才复制的 Personal Access Token

4. 点击 **"Add secret"** 保存

### 3. 验证配置

配置完成后，下次推送代码到 master 分支时，GitHub Actions workflow 将会：

1. 使用 PAT_TOKEN 进行 checkout（如果配置了）
2. 构建应用
3. 更新版本号
4. **成功推送版本更新回 master 分支**（之前会失败）
5. 创建 GitHub Release

## 工作原理

修改后的 workflow 配置：

```yaml
- name: Checkout repository
  uses: actions/checkout@v4
  with:
    fetch-depth: 0
    # 如果配置了 PAT_TOKEN，使用它；否则使用默认的 GITHUB_TOKEN
    token: ${{ secrets.PAT_TOKEN || github.token }}
```

这样的配置具有以下优势：
- ✅ 如果配置了 PAT_TOKEN，使用它来绕过分支保护规则
- ✅ 如果没有配置，降级使用默认的 github.token（推送会失败但 release 仍会创建）
- ✅ 不影响其他功能，只是推送步骤可能失败

## 安全建议

1. **最小权限原则**: PAT 只授予必要的权限（repo 和 workflow）
2. **定期轮换**: 建议定期更新 Token
3. **监控使用**: 定期检查 Token 的使用情况
4. **及时撤销**: 如果 Token 泄露，立即在 GitHub Settings 中撤销

## 替代方案

如果您不想使用 PAT，也可以：

1. **移除推送步骤**: 删除 workflow 中的 "Commit version bump" 步骤
   - 优点：不需要额外配置
   - 缺点：版本号不会自动提交回仓库

2. **手动更新版本**: 每次发布前手动更新 package.json 和 tauri.conf.json 中的版本号

3. **修改分支保护规则**: 在仓库设置中调整分支保护规则
   - Settings → Rules → Rulesets → 编辑规则
   - 但这可能降低代码审查的安全性

## 故障排查

### 问题：推送仍然失败

检查以下事项：
1. PAT_TOKEN 是否正确配置在仓库 Secrets 中
2. PAT 是否具有 `repo` 权限
3. PAT 是否已过期
4. 仓库地址是否正确

### 问题：Token 权限不足

错误信息：`remote: Permission to ... denied`

解决方法：
1. 重新生成 Token，确保勾选 `repo` 权限
2. 更新仓库 Secret 中的 PAT_TOKEN

## 相关文档

- [GitHub Actions Permissions](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token)
- [Creating a Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

