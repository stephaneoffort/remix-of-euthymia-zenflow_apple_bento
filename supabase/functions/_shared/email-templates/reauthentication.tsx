/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre code de vérification — ZenFlow</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>ZenFlow</Text>
          <Text style={tagline}>Gestion de projets</Text>
        </Section>
        <Section style={content}>
          <Heading style={h1}>Confirmez votre identité</Heading>
          <Text style={text}>
            Utilisez le code ci-dessous pour confirmer votre identité :
          </Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={footer}>
            Ce code expire rapidement. Si vous n'êtes pas à l'origine de cette
            demande, ignorez cet email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
}
const container = { padding: '0', maxWidth: '520px' }
const header = {
  backgroundColor: '#155E75',
  borderRadius: '12px 12px 0 0',
  padding: '28px 32px',
  textAlign: 'center' as const,
}
const brand = {
  margin: '0',
  fontSize: '20px',
  fontWeight: 'bold' as const,
  color: '#ffffff',
  letterSpacing: '-0.3px',
}
const tagline = { margin: '6px 0 0', fontSize: '12px', color: '#BAE6FD' }
const content = { padding: '32px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0F2A33',
  margin: '0 0 16px',
}
const text = {
  fontSize: '15px',
  color: '#52525b',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '26px',
  fontWeight: 'bold' as const,
  letterSpacing: '4px',
  color: '#155E75',
  margin: '0 0 30px',
}
const footer = { fontSize: '12px', color: '#8E8E93', margin: '30px 0 0' }
