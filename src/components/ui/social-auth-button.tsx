import { Button } from "./button";

/**
 * Modern Google OAuth button - styled with Google's primary colors
 * Red background with white text, premium hover effect
 */
export function GoogleAuthButton({
  className,
  size = "md",
  onClick,
  ...props
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  onClick: () => void;
}) {
  // Google red: bg-red-500 text-white hover:bg-red-600
  const googleClassName = className
    ? `${className} bg-red-500 text-white hover:bg-red-600`
    : `bg-red-500 text-white hover:bg-red-600`;
  return (
    <Button
      type="button"
      size={size}
      className={googleClassName}
      onClick={onClick}
      {...props}
    >
      Sign in with Google
    </Button>
  );
}

/**
 * Modern GitHub OAuth button - styled with GitHub's colors
 * Dark background with white text, premium hover effect
 */
export function GitHubAuthButton({
  className,
  size = "md",
  onClick,
  ...props
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  onClick: () => void;
}) {
  // GitHub dark: bg-gray-800 text-white hover:bg-gray-700
  const githubClassName = className
    ? `${className} bg-gray-800 text-white hover:bg-gray-700`
    : `bg-gray-800 text-white hover:bg-gray-700`;
  return (
    <Button
      type="button"
      size={size}
      className={githubClassName}
      onClick={onClick}
      {...props}
    >
      Sign in with GitHub
    </Button>
  );
}