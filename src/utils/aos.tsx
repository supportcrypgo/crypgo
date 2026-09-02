'use client'
import { useEffect } from "react";
import AOS from "aos"

const Aoscompo = ({children}:any) => {
    useEffect(() => {
        AOS.init({
            duration: 800,
            once: false,
        })
    }, [])
  return (
    <div>
      {children}
    </div>
  )
}

export default Aoscompo
