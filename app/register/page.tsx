import type { Metadata } from 'next';
import AuthForm from '../auth-form';
export const metadata:Metadata={title:'Create an account — schwank'};
export default function RegisterPage(){return <AuthForm mode="register"/>;}
