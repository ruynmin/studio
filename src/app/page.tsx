'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL, SystemProgram, Transaction as SolanaTransaction, PublicKey } from '@solana/web3.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { getTokenBalance, getTransactionHistory, type TokenBalance, type Transaction as AppTransaction } from '@/services/solana';
import { formatDistanceToNow } from 'date-fns';
import { Send, RefreshCw, Copy, Check, ExternalLink } from 'lucide-react';
import { SolanaIcon } from '@/components/icons/SolanaIcon'; // Import SolanaIcon


interface TransactionHistory extends AppTransaction {
  signature: string;
  blockTime: number;
}

export default function Home() {
  const { publicKey, connected, sendTransaction, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [history, setHistory] = useState<TransactionHistory[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const fetchBalance = useCallback(async () => {
    if (!connected || !publicKey || !connection) return;
    setLoadingBalance(true);
    setError(null);
    try {
      const balance = await connection.getBalance(publicKey);
      setBalance(balance / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error("Error fetching balance:", err);
      setError("Failed to fetch balance.");
      toast({ title: "Error", description: "Failed to fetch SOL balance.", variant: "destructive" });
    } finally {
      setLoadingBalance(false);
    }
  }, [connected, publicKey, connection, toast]);

  const fetchTokenBalances = useCallback(async () => {
    if (!connected || !publicKey) return;
    setLoadingTokens(true);
    setError(null);
    try {
      // Using the mock function for now
      const tokens = await getTokenBalance(publicKey.toBase58());
      setTokenBalances(tokens);
    } catch (err) {
      console.error("Error fetching token balances:", err);
      setError("Failed to fetch token balances.");
      toast({ title: "Error", description: "Failed to fetch token balances.", variant: "destructive" });
    } finally {
      setLoadingTokens(false);
    }
  }, [connected, publicKey, toast]);


  const fetchHistory = useCallback(async () => {
    if (!connected || !publicKey || !connection) return;
    setLoadingHistory(true);
    setError(null);
    try {
      const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 10 });
      const detailedHistory: TransactionHistory[] = await Promise.all(
        signatures.map(async (sigInfo) => {
          // Basic info from signature list
          return {
            id: sigInfo.signature, // Use signature as ID
            signature: sigInfo.signature,
            timestamp: sigInfo.blockTime ? sigInfo.blockTime * 1000 : Date.now(), // Convert seconds to ms
            blockTime: sigInfo.blockTime || 0,
            amount: 0, // Placeholder, need detailed tx for actual amount
            recipient: 'N/A', // Placeholder
          };
        })
      );
      setHistory(detailedHistory.sort((a, b) => b.timestamp - a.timestamp)); // Sort by newest first
    } catch (err) {
      console.error("Error fetching history:", err);
      setError("Failed to fetch transaction history.");
      toast({ title: "Error", description: "Failed to fetch transaction history.", variant: "destructive" });
    } finally {
      setLoadingHistory(false);
    }
  }, [connected, publicKey, connection, toast]);


  useEffect(() => {
    if (connected && publicKey && connection) {
      fetchBalance();
      fetchHistory();
      fetchTokenBalances();
    } else {
      setBalance(null);
      setHistory([]);
      setTokenBalances([]);
      setError(null);
    }
  }, [connected, publicKey, connection, fetchBalance, fetchHistory, fetchTokenBalances]);

  const handleSend = async () => {
    if (!connected || !publicKey || !recipient || !amount || !connection || !signTransaction) {
      setError("Please connect wallet and fill in all fields.");
      return;
    }

    setError(null);
    setSending(true);
    setTxSignature(null);

    try {
      const recipientPubKey = new PublicKey(recipient);
      const lamports = parseFloat(amount) * LAMPORTS_PER_SOL;

      if (isNaN(lamports) || lamports <= 0) {
        setError("Invalid amount.");
        setSending(false);
        return;
      }

      const transaction = new SolanaTransaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientPubKey,
          lamports: lamports,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);
      setTxSignature(signature);

      toast({
          title: "Transaction Submitted",
          description: `Transaction signature: ${signature.substring(0, 10)}...${signature.substring(signature.length - 10)}`,
          action: (
             <Button variant="outline" size="sm" asChild>
                <a
                  href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                   View on Explorer <ExternalLink className="ml-2 h-4 w-4"/>
                 </a>
             </Button>
          ),
      });

      // Optionally wait for confirmation
      await connection.confirmTransaction(signature, 'processed');

      toast({ title: "Transaction Confirmed", description: "Your SOL has been sent successfully." });

      // Reset form and refresh data
      setRecipient('');
      setAmount('');
      fetchBalance();
      fetchHistory();


    } catch (error: any) {
      console.error("Send error:", error);
      let errorMessage = "Transaction failed.";
      if (error.message.includes('Invalid public key input')) {
          errorMessage = "Invalid recipient address.";
      } else if (error.message.includes('Transaction simulation failed')) {
          errorMessage = "Transaction simulation failed. Check balance or network status.";
      } else if (error.message.includes('User rejected the request')) {
          errorMessage = "Transaction cancelled by user.";
      }
      setError(errorMessage);
      toast({ title: "Transaction Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = () => {
    if (connected && publicKey && connection) {
      fetchBalance();
      fetchHistory();
      fetchTokenBalances();
      toast({ title: "Data Refreshed", description: "Wallet data updated." });
    }
  };

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500); // Reset icon after 1.5 seconds
    }
  };

  const formatAddress = (address: string | undefined) => {
    if (!address) return 'N/A';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-4xl mb-8 flex justify-between items-center">
        <div className="flex items-center space-x-2">
           <SolanaIcon className="h-8 w-8 text-primary" />
           <h1 className="text-3xl font-bold">SolLink</h1>
        </div>
        <WalletMultiButton />
      </header>

      <main className="w-full max-w-4xl">
        {!connected ? (
          <Card className="text-center shadow-lg animate-pulse">
            <CardHeader>
              <CardTitle>Welcome to SolLink</CardTitle>
              <CardDescription>Please connect your Solana wallet to get started.</CardDescription>
            </CardHeader>
            <CardContent>
              <SolanaIcon className="h-16 w-16 mx-auto text-primary opacity-50" />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Wallet Info Card */}
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Wallet Information</CardTitle>
                  <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={loadingBalance || loadingHistory || loadingTokens}>
                    <RefreshCw className={`h-4 w-4 ${loadingBalance || loadingHistory || loadingTokens ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                {publicKey && (
                  <CardDescription className="flex items-center space-x-2 pt-1">
                    <span>{formatAddress(publicKey?.toBase58())}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyAddress}>
                      {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </CardDescription>
                 )}
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="sol" className="w-full">
                   <TabsList className="grid w-full grid-cols-2 mb-4">
                     <TabsTrigger value="sol">SOL</TabsTrigger>
                     <TabsTrigger value="tokens">Tokens</TabsTrigger>
                   </TabsList>
                   <TabsContent value="sol">
                    <div className="space-y-2">
                       <p className="text-sm font-medium">SOL Balance</p>
                       {loadingBalance ? (
                         <Skeleton className="h-8 w-3/4" />
                       ) : (
                         <p className="text-2xl font-bold text-primary">{balance !== null ? `${balance.toFixed(4)} SOL` : 'N/A'}</p>
                       )}
                     </div>
                   </TabsContent>
                   <TabsContent value="tokens">
                     <div className="space-y-2">
                       <p className="text-sm font-medium">Token Balances</p>
                       {loadingTokens ? (
                         <>
                          <Skeleton className="h-6 w-1/2 mb-1" />
                          <Skeleton className="h-6 w-1/3" />
                         </>
                       ) : tokenBalances.length > 0 ? (
                         <ul className="space-y-1">
                           {tokenBalances.map((token) => (
                             <li key={token.symbol || 'unknown'} className="flex justify-between">
                               <span>{token.symbol || 'Unknown Token'}</span>
                               <span>{token.balance.toLocaleString()}</span>
                             </li>
                           ))}
                         </ul>
                       ) : (
                         <p className="text-sm text-muted-foreground">No other tokens found.</p>
                       )}
                     </div>
                   </TabsContent>
                 </Tabs>


              </CardContent>
            </Card>

            {/* Transaction Card */}
            <Card className="shadow-lg">
               <CardHeader>
                 <CardTitle>Actions</CardTitle>
                 <CardDescription>Send SOL to another wallet.</CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 <div>
                   <label htmlFor="recipient" className="block text-sm font-medium mb-1">Recipient Address</label>
                   <Input
                     id="recipient"
                     type="text"
                     placeholder="Enter Solana address"
                     value={recipient}
                     onChange={(e) => setRecipient(e.target.value)}
                     className="text-base md:text-sm" // Consistent input size
                     disabled={sending}
                   />
                 </div>
                 <div>
                   <label htmlFor="amount" className="block text-sm font-medium mb-1">Amount (SOL)</label>
                   <Input
                     id="amount"
                     type="number"
                     placeholder="0.0"
                     value={amount}
                     onChange={(e) => setAmount(e.target.value)}
                     className="text-base md:text-sm" // Consistent input size
                     disabled={sending}
                     step="any"
                     min="0"
                   />
                 </div>
                 {error && (
                     <Alert variant="destructive" className="animate-pulse">
                       <AlertTitle>Error</AlertTitle>
                       <AlertDescription>{error}</AlertDescription>
                     </Alert>
                 )}
               </CardContent>
               <CardFooter>
                  <Button onClick={handleSend} disabled={sending || !recipient || !amount || parseFloat(amount) <= 0} className="w-full">
                    {sending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" /> Send SOL
                      </>
                    )}
                  </Button>
               </CardFooter>
             </Card>


            {/* Transaction History */}
            <Card className="md:col-span-2 shadow-lg">
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Your recent Solana transactions.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {loadingHistory ? (
                    <div className="space-y-4">
                       <Skeleton className="h-10 w-full" />
                       <Skeleton className="h-10 w-full" />
                       <Skeleton className="h-10 w-full" />
                    </div>
                  ) : history.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Signature</TableHead>
                           <TableHead className="text-right">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="text-muted-foreground">
                              {formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatAddress(tx.signature)}
                            </TableCell>
                             <TableCell className="text-right">
                                <Button variant="ghost" size="sm" asChild>
                                   <a
                                     href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     className="flex items-center justify-end text-accent hover:underline"
                                   >
                                      View <ExternalLink className="ml-1 h-3 w-3"/>
                                    </a>
                                </Button>
                             </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">No transaction history found.</p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
