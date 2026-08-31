import type { Metadata } from 'next';
import AuthForm from '../auth-form';
export const metadata:Metadata={title:'Sign in — schwank'};
export default function LoginPage(){return <AuthForm mode="login"/>;}
