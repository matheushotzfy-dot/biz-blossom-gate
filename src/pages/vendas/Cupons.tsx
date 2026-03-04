/**
 * Cupons — Gestão de cupons promocionais (redirect para Checkout)
 * @module Cupons
 * @version 2.0.0
 * @author msDev's — Engenharia de Software
 * @description Módulo de cupons integrado ao fluxo de checkout.
 *   A gestão completa de cupons está centralizada na aba Checkout.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Cupons() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/vendas/checkout", { replace: true }); }, [navigate]);
  return null;
}
