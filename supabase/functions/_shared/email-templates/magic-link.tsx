/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre lien de connexion — ZenFlow</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>ZenFlow</Text>
          <Text style={tagline}>Gestion de projets</Text>
        </Section>
        <Section style={content}>
          <Heading style={h1}>Votre lien de connexion</Heading>
          <Text style={text}>
            Cliquez sur le bouton ci-dessous pour vous connecter à ZenFlow. Ce
            lien est à usage unique.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Se connecter
          </Button>
          <Text style={footer}>
            Si vous n'avez pas demandé ce lien, ignorez cet email. Ce lien
            expire dans 1 heure.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
  margin: '0 0 25px',
}
const button = {
  backgroundColor: '#F4633A',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '13px 28px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#8E8E93', margin: '30px 0 0' }
