import React from "react";

export default function StepCard({ children, delay = 0, className = "" }) {
  const ref = React.useRef(null);
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShow(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <li
      ref={ref}
      className={`transform transition-all duration-1000 ease-out
        ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </li>
  );
}
