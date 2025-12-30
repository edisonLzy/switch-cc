# 生产环境登录失败问题修复

## 问题描述
用户反馈生产环境无法调用业务接口导致无法正常登陆，报错提示 "Load failed"，但在开发环境（Development）下一切正常。

## 原因分析
经过排查，发现原因如下：
1. **API 协议差异**: 生产环境使用的 API 地址 (`http://119.29.80.76:3000`) 是 HTTP 协议，而非 HTTPS。
2. **macOS 安全策略**: macOS 的 App Transport Security (ATS) 默认禁止应用发起不安全的 HTTP 连接。
3. **环境差异**: 开发环境通常宽松一些，或者调试模式下未强制执行此策略，导致开发环境正常但打包后的生产环境失败。

## 解决方案
为了解决这个问题，我们需要在 macOS 应用包中显式允许 HTTP 请求。通过添加 `Info.plist` 文件并配置 `NSAppTransportSecurity` 来实现。

### 操作步骤
在 `src-tauri/` 目录下创建一个名为 `Info.plist` 的文件，内容如下：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- 允许应用程序忽略 ATS 限制，从而支持 HTTP 请求 -->
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <true/>
    </dict>
</dict>
</plist>
```

该配置将覆盖 macOS 的默认安全设置，允许应用连接到 HTTP 服务器。

### 验证
重新构建生产版本 (`pnpm build`) 并运行，登录功能应恢复正常。
