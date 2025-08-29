import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 4v16h16" />
      <path d="M4 20l7-7" />
      <path d="M15 8l5-5" />
      <path d="m15 3 6 0 0 6" />
    </svg>
  );
}
