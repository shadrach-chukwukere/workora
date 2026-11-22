import { Button } from "./button";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-2 4.6-4.3 6v5.1h6.9c4-3.7 6-9 6-14.8Z"
      />
      <path
        fill="#34A853"
        d="M24 44c5.5 0 10.2-1.8 13.6-4.8l-6.9-5.1c-1.9 1.3-4.1 2-6.7 2-5.2 0-9.7-3.5-11.3-8.3H3.6v5.3C7 36.8 14.8 44 24 44Z"
      />
      <path
        fill="#FBBC05"
        d="M12.7 27.8a12 12 0 0 1 0-7.6v-5.3H3.6a20 20 0 0 0 0 18.2l9.1-5.3Z"
      />
      <path
        fill="#EA4335"
        d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.4 4 24 4 14.8 4 7 11.2 3.6 19.4l9.1 5.3c1.6-4.8 6.1-8.3 11.3-8.3Z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.69c-2.78.6-3.37-1.18-3.37-1.18-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1.01.07 1.54 1.04 1.54 1.04.89 1.53 2.33 1.09 2.9.83.09-.64.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.1.39-2 1.03-2.71-.1-.25-.45-1.28.1-2.66 0 0 .84-.27 2.75 1.03a9.56 9.56 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.41.1 2.66.64.71 1.03 1.61 1.03 2.71 0 3.85-2.35 4.7-4.58 4.95.36.31.68.92.68 1.85v2.57c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"
      />
    </svg>
  );
}

export function GoogleAuthButton({
  className = "",
  size = "md",
  onClick,
  ...props
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size={size}
      onClick={onClick}
      className={`w-full justify-center gap-3 border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 hover:border-gray-300 ${className}`}
      {...props}
    >
      <GoogleIcon />
      <span>Continue with Google</span>
    </Button>
  );
}

export function GitHubAuthButton({
  className = "",
  size = "md",
  onClick,
  ...props
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size={size}
      onClick={onClick}
      className={`w-full justify-center gap-3 border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 hover:border-gray-300 ${className}`}
      {...props}
    >
      <GitHubIcon />
      <span>Continue with GitHub</span>
    </Button>
  );
}