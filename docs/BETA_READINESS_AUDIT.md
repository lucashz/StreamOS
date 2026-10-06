# Auditoria de prontidão — beta fechada

Atualizado em 05/10/2026. Evidências executadas no ambiente local.

| Jornada | Estado | Evidência | Bloqueador / saída |
| --- | --- | --- | --- |
| Entrada e identidade | BLOQUEADOR | `test:e2e:accounts` aprovou cadastro, login, sessões, perfil e senha. | Cadastro está aberto; implementar convite obrigatório e testar código inválido, revogado e e-mail divergente. |
| Página inicial | PENDENTE | Playwright responsivo aprovado. | Revisar conteúdo e CTA da beta após o bloqueio de convites. |
| Onboarding | PENDENTE | Onboarding usado por todos os E2Es pagos. | Falta provar que o criador entende o próximo passo ao retornar incompleto. |
| Página pública e contribuição | PRONTO | Fluxo local, pagamentos, campanhas, SongPix e VideoPix aprovados; Playwright responsivo aprovado. | Revalidar estados de URL inexistente e recurso despublicado. |
| Carteira | PRONTO | `test:e2e:wallet` aprovou recebível, chave Pix protegida e kill switch. | Saque real fora da beta até homologação. |
| Alertas, OBS e Central | PRONTO | `test:e2e:alerts`, `test:e2e:widgets`, `test:e2e:alert-reliability` e Playwright aprovados. | Sem bloqueador local. |
| Moderação e TTS | PRONTO | `test:e2e:moderation` aprovado. | Sem bloqueador local. |
| Configurações e plataforma | PRONTO | `test:e2e:platform` aprovou RBAC, tokens e webhooks. | Sem bloqueador local. |
| Staging | BLOQUEADOR | `preflight:staging` falhou pela ausência de `.env.staging`. | Criar ambiente com URLs e credenciais, executar preflight e smoke. |

## Próximo ciclo

Implementar convites obrigatórios para fechar o acesso da beta.
