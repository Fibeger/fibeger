'use client';

import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 opacity-80 animate-gradient" />
        <div className="absolute inset-0 bg-gradient-to-tl from-blue-500 via-cyan-500 to-teal-500 opacity-60 animate-gradient-reverse" />
        <div className="absolute inset-0 backdrop-blur-3xl" />
      </div>

      {/* Floating Orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
      <div className="absolute top-40 right-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
      <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />

      {/* Content */}
      <main className="relative z-10 flex flex-col items-center justify-center max-w-4xl w-full px-6 text-center">
        <div className="space-y-8 backdrop-blur-sm bg-white/10 rounded-3xl p-12 shadow-2xl border border-white/20">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/20 backdrop-blur-md border border-white/30 mb-4">
            <span className="text-5xl font-bold text-white">F</span>
          </div>

          <h1 className="text-7xl font-extrabold text-white leading-tight tracking-tight">
            Fibeger
          </h1>

          <p className="text-xl text-white/90 max-w-lg mx-auto font-light">
            Connect, chat, and share moments with friends
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <Link
              href="/auth/signup"
              className="group relative px-8 py-4 bg-white text-purple-600 rounded-full font-semibold text-lg transition-all hover:scale-105 hover:shadow-2xl"
            >
              Get Started
              <span className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
            </Link>
            <Link
              href="/auth/login"
              className="px-8 py-4 bg-white/10 backdrop-blur-md text-white border-2 border-white/30 rounded-full font-semibold text-lg transition-all hover:bg-white/20 hover:scale-105"
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>

      <style jsx>{`
        @keyframes gradient {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes gradient-reverse {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-30px, 50px) scale(0.9); }
          66% { transform: translate(20px, -20px) scale(1.1); }
        }
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-gradient {
          animation: gradient 15s ease infinite;
        }
        .animate-gradient-reverse {
          animation: gradient-reverse 15s ease infinite;
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
