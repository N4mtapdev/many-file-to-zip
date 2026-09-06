"use client";

import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-[420px] text-center">
        <h1 className="text-[22px] font-black text-ink-dark mb-2">
          Không có quyền truy cập
        </h1>
        <p className="text-[14px] text-ink-medium mb-6">
          Tài khoản Google này không được phép sử dụng công cụ này. Vui lòng
          đăng nhập bằng đúng tài khoản được cấp quyền.
        </p>
        <Link
          href="/api/auth/signin"
          className="inline-block rounded-lg bg-primary text-white font-black text-[14px] px-6 h-[44px] leading-[44px] hover:bg-primary-deep transition-colors"
        >
          Thử đăng nhập lại
        </Link>
      </div>
    </main>
  );
}
