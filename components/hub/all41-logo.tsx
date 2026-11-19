import Link from "next/link";
import { cn } from "@/lib/utils";

/** Same four rounded-square/infinity geometry as the public all41.app brand. */
export function All41Mark({size=32,className}:{size?:number,className?:string}){
 return <svg viewBox="0 0 80 80" width={size} height={size} aria-hidden="true" className={cn("shrink-0",className)}>
  <rect x="4" y="4" width="34" height="34" rx="11" fill="var(--all41-identity,#F9703E)"/>
  <rect x="42" y="4" width="34" height="34" rx="11" fill="var(--all41-identity,#F9703E)"/>
  <rect x="4" y="42" width="34" height="34" rx="11" fill="var(--all41-identity,#F9703E)"/>
  <rect x="42" y="42" width="34" height="34" rx="11" fill="var(--all41-accent,#B8E4D1)"/>
  <path d="M7 43 C20 43 24 25 36 25 C50 25 49 48 63 48 C69 48 71 45 74 42" fill="none" stroke="var(--all41-surface,#FFFFFF)" strokeWidth="8" strokeLinecap="round"/>
 </svg>
}

export function All41Logo({href,compact=false,className}:{
 href?:string;compact?:boolean;className?:string
}){
 const contents=<><All41Mark size={compact?28:34}/>{!compact&&<span className="font-title text-h4 font-extrabold tracking-[-0.075em] text-ink-800">all41<span className="text-brand-500">.</span></span>}</>;
 const classes=cn("inline-flex items-center gap-2.5",className);
 return href?<Link href={href} className={classes} aria-label="All41 home">{contents}</Link>:<span className={classes}>{contents}</span>;
}
