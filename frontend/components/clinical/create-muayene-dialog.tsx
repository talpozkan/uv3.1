'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Loader2, Save } from 'lucide-react';
import { format } from 'date-fns';

const formSchema = z.object({
    tarih: z.string().optional(),
    sikayet: z.string().optional(),
    oyku: z.string().optional(),

    // Physical Exam
    tansiyon: z.string().optional(),
    ates: z.string().optional(),
    kvah: z.string().optional(),
    bobrek_sag: z.string().optional(),
    bobrek_sol: z.string().optional(),
    suprapubik_kitle: z.string().optional(),
    ego: z.string().optional(),
    rektal_tuse: z.string().optional(),

    // Symptoms
    disuri: z.string().optional(),
    pollakiuri: z.string().optional(),
    nokturi: z.string().optional(),
    hematuri: z.string().optional(),
    genital_akinti: z.string().optional(),
    kabizlik: z.string().optional(),
    tas_oyku: z.string().optional(),

    // IPSS
    catallanma: z.string().optional(),
    projeksiyon_azalma: z.string().optional(),
    kalibre_incelme: z.string().optional(),
    idrar_bas_zorluk: z.string().optional(),
    kesik_idrar_yapma: z.string().optional(),
    terminal_damlama: z.string().optional(),
    residiv_hissi: z.string().optional(),
    inkontinans: z.string().optional(),
});

interface CreateMuayeneDialogProps {
    patientId: string;
}

export function CreateMuayeneDialog({ patientId }: CreateMuayeneDialogProps) {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            tarih: format(new Date(), 'yyyy-MM-dd'),
            sikayet: '',
            oyku: '',
            tansiyon: '', ates: '', kvah: '', bobrek_sag: '', bobrek_sol: '',
            suprapubik_kitle: '', ego: '', rektal_tuse: '',
            disuri: '', pollakiuri: '', nokturi: '', hematuri: '',
            genital_akinti: '', kabizlik: '', tas_oyku: '',
            catallanma: '', projeksiyon_azalma: '', kalibre_incelme: '',
            idrar_bas_zorluk: '', kesik_idrar_yapma: '', terminal_damlama: '',
            residiv_hissi: '', inkontinans: '',
        },
    });

    const createMuayeneMutation = useMutation({
        mutationFn: (values: z.infer<typeof formSchema>) =>
            api.clinical.createMuayene({ ...values, hasta_id: patientId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['muayeneler', patientId] });
            toast.success('Muayene kaydı oluşturuldu');
            setOpen(false);
            form.reset();
        },
        onError: (error) => {
            toast.error('Muayene oluşturulurken hata oluştu');
            console.error(error);
        },
    });

    function onSubmit(values: z.infer<typeof formSchema>) {
        // Clean up empty strings to undefined
        const data = Object.fromEntries(
            Object.entries(values).map(([key, value]) => [key, value === '' ? undefined : value])
        );
        createMuayeneMutation.mutate(data);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-to-r from-blue-600 to-cyan-600">
                    <Plus className="mr-2 h-4 w-4" />
                    Yeni Muayene
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Yeni Muayene Kaydı</DialogTitle>
                    <DialogDescription>
                        Yeni muayene detaylarını giriniz.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <Tabs defaultValue="genel" className="w-full">
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="genel">Genel</TabsTrigger>
                                <TabsTrigger value="fizik">Fizik M.</TabsTrigger>
                                <TabsTrigger value="semptom">Semptom</TabsTrigger>
                                <TabsTrigger value="ipss">İşeme (IPSS)</TabsTrigger>
                            </TabsList>

                            <TabsContent value="genel" className="space-y-4 pt-4">
                                <FormField
                                    control={form.control}
                                    name="tarih"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tarih</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="sikayet"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Şikayet</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Hastanın şikayeti..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="oyku"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Öykü</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Hikaye..." className="h-32" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>

                            <TabsContent value="fizik" className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="tansiyon" render={({ field }) => (
                                        <FormItem><FormLabel>Tansiyon</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="ates" render={({ field }) => (
                                        <FormItem><FormLabel>Ateş</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="kvah" render={({ field }) => (
                                        <FormItem><FormLabel>KVAH</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="ego" render={({ field }) => (
                                        <FormItem><FormLabel>EGO</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="bobrek_sag" render={({ field }) => (
                                        <FormItem><FormLabel>Böbrek Sağ</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="bobrek_sol" render={({ field }) => (
                                        <FormItem><FormLabel>Böbrek Sol</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                                <FormField control={form.control} name="suprapubik_kitle" render={({ field }) => (
                                    <FormItem><FormLabel>Suprapubik Kitle</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="rektal_tuse" render={({ field }) => (
                                    <FormItem><FormLabel>Rektal Tuşe</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </TabsContent>

                            <TabsContent value="semptom" className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    {['disuri', 'pollakiuri', 'nokturi', 'hematuri', 'genital_akinti', 'kabizlik', 'tas_oyku'].map((item) => (
                                        <FormField key={item} control={form.control} name={item as any} render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="capitalize">{item.replace('_', ' ')}</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="ipss" className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    {['catallanma', 'projeksiyon_azalma', 'kalibre_incelme', 'idrar_bas_zorluk', 'kesik_idrar_yapma', 'terminal_damlama', 'residiv_hissi', 'inkontinans'].map((item) => (
                                        <FormField key={item} control={form.control} name={item as any} render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="capitalize">{item.replace('_', ' ')}</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    ))}
                                </div>
                            </TabsContent>
                        </Tabs>

                        <div className="flex justify-end pt-4 border-t mt-4">
                            <Button type="submit" disabled={createMuayeneMutation.isPending} className="w-full sm:w-auto">
                                {createMuayeneMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                <Save className="mr-2 h-4 w-4" />
                                Kaydet
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
