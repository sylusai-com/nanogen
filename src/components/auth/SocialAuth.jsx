"use client";

function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path fill="#EA4335" d="M12 10.2v3.8h5.3c-.2 1.4-1.7 4.2-5.3 4.2-3.2 0-5.8-2.6-5.8-5.9S8.8 6.4 12 6.4c1.8 0 3 .8 3.7 1.4l2.5-2.5C16.6 3.8 14.5 3 12 3 6.9 3 2.8 7.1 2.8 12.3S6.9 21.6 12 21.6c6.9 0 9.4-4.9 9.4-7.4 0-.5-.1-.9-.1-1.3H12z"/>
      <path fill="#34A853" d="M3.6 7.6l3.2 2.4C7.5 8.2 9.6 6.8 12 6.8c1.8 0 3 .8 3.7 1.4l2.5-2.5C16.6 4.2 14.5 3.4 12 3.4 8.3 3.4 5.1 5.1 3.6 7.6z"/>
      <path fill="#4285F4" d="M21.4 12.5c0-.5-.1-.9-.1-1.3H12v3.8h5.3c-.2 1-.9 2.4-2.6 3.3l3.2 2.4c1.9-1.7 3.5-4.4 3.5-8.2z"/>
      <path fill="#FBBC05" d="M6.8 14.3c-.2-.6-.4-1.3-.4-2 0-.7.1-1.4.4-2L3.6 7.9C2.9 9.2 2.5 10.7 2.5 12.3c0 1.6.4 3.1 1.1 4.4l3.2-2.4z"/>
    </svg>
  );
}

function GithubIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.04c-3.2.7-3.87-1.37-3.87-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.95.1-.74.4-1.25.73-1.54-2.55-.29-5.23-1.27-5.23-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.17.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.2-1.48 3.16-1.17 3.16-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.35.78 1.05.78 2.12v3.14c0 .31.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

export default function SocialAuth({ disabled }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <button
        type="button"
        disabled={disabled}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm text-foreground hover:border-border-strong hover:bg-surface transition-colors disabled:opacity-50"
      >
        <GoogleIcon className="h-4 w-4" />
        Google
      </button>
      <button
        type="button"
        disabled={disabled}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm text-foreground hover:border-border-strong hover:bg-surface transition-colors disabled:opacity-50"
      >
        <GithubIcon className="h-4 w-4" />
        GitHub
      </button>
    </div>
  );
}
