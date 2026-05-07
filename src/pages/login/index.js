"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}


export async function getServerSideProps(ctx) {
  const role = typeof ctx.query.role === "string" ? ctx.query.role.toLowerCase() : "";
  if (role === "owner" || role === "manager" || role === "employee") {
    return {
      redirect: {
        destination: `/login/${role}`,
        permanent: false,
      },
    };
  }
  return { props: {} };
}

