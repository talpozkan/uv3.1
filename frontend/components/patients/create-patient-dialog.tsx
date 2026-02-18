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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Loader2, User, Phone, MapPin, FileText } from 'lucide-react';
import { formatPhoneNumber } from '@/lib/utils';
import { ReferenceInput } from './reference-input';
import { BirthplaceSelect } from './birthplace-select';

const formSchema = z.object({
    ad: z.string().min(2, 'Ad en az 2 karakter olmalıdır'),
    soyad: z.string().min(2, 'Soyad en az 2 karakter olmalıdır'),
    tc_kimlik: z.string().length(11, 'TC Kimlik 11 haneli olmalıdır').optional().or(z.literal('')),
    cinsiyet: z.string().optional(),
    dogum_tarihi: z.string().optional().or(z.literal('')),
    dogum_yeri: z.string().optional(),
    kan_grubu: z.string().optional(),
    medeni_hal: z.string().optional(),
    meslek: z.string().optional(),

    // Contact
    cep_tel: z.string().optional().or(z.literal('')),
    ev_tel: z.string().optional().or(z.literal('')),
    is_tel: z.string().optional().or(z.literal('')),
    email: z.string().email('Geçersiz e-posta adresi').optional().or(z.literal('')),

    // Address & Notes
    adres: z.string().optional(),
    kimlik_notlar: z.string().optional(),
    referans: z.string().optional(),
});

export function CreatePatientDialog() {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            ad: '', soyad: '', tc_kimlik: '', cinsiyet: 'ERKEK', dogum_tarihi: '',
            dogum_yeri: '', kan_grubu: '', medeni_hal: '', meslek: '',
            cep_tel: '+90 ', ev_tel: '+90 ', is_tel: '+90 ', email: '',
            adres: '', kimlik_notlar: '', referans: '',
        },
    });

    const createPatientMutation = useMutation({
        mutationFn: api.patients.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['patients'] });
            toast.success('Hasta başarıyla oluşturuldu');
            setOpen(false);
            form.reset();
        },
        onError: (error) => {
            toast.error('Hasta oluşturulurken bir hata oluştu');
            console.error(error);
        },
    });

    function onSubmit(values: z.infer<typeof formSchema>) {
        const data = Object.fromEntries(
            Object.entries(values).map(([key, value]) => [key, value === '' ? undefined : value])
        ) as any;
        createPatientMutation.mutate(data);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="mr-2 h-4 w-4" />
                    Yeni Hasta
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Yeni Hasta Kaydı</DialogTitle>
                    <DialogDescription>
                        Hasta bilgilerini eksiksiz girmeye özen gösteriniz.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <Tabs defaultValue="kimlik" className="w-full">
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="kimlik">
                                    <User className="mr-2 h-4 w-4" /> Kimlik
                                </TabsTrigger>
                                <TabsTrigger value="iletisim">
                                    <Phone className="mr-2 h-4 w-4" /> İletişim
                                </TabsTrigger>
                                <TabsTrigger value="adres">
                                    <MapPin className="mr-2 h-4 w-4" /> Adres
                                </TabsTrigger>
                                <TabsTrigger value="notlar">
                                    <FileText className="mr-2 h-4 w-4" /> Notlar
                                </TabsTrigger>
                            </TabsList>

                            {/* Tab 1: Kimlik */}
                            <TabsContent value="kimlik" className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="ad" render={({ field }) => (
                                        <FormItem><FormLabel>Ad <span className="text-red-500">*</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="soyad" render={({ field }) => (
                                        <FormItem><FormLabel>Soyad <span className="text-red-500">*</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="tc_kimlik" render={({ field }) => (
                                        <FormItem><FormLabel>TC Kimlik</FormLabel><FormControl><Input maxLength={11} {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="dogum_tarihi" render={({ field }) => (
                                        <FormItem><FormLabel>Doğum Tarihi</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="cinsiyet" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cinsiyet</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="ERKEK">Erkek</SelectItem>
                                                    <SelectItem value="KADIN">Kadın</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="medeni_hal" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Medeni Hal</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="EVLI">Evli</SelectItem>
                                                    <SelectItem value="BEKAR">Bekar</SelectItem>
                                                    <SelectItem value="DUL">Dul</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="dogum_yeri" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Doğum Yeri</FormLabel>
                                            <FormControl>
                                                <BirthplaceSelect field={field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="kan_grubu" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Kan Grubu</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="A+">A Rh(+)</SelectItem>
                                                    <SelectItem value="A-">A Rh(-)</SelectItem>
                                                    <SelectItem value="B+">B Rh(+)</SelectItem>
                                                    <SelectItem value="B-">B Rh(-)</SelectItem>
                                                    <SelectItem value="AB+">AB Rh(+)</SelectItem>
                                                    <SelectItem value="AB-">AB Rh(-)</SelectItem>
                                                    <SelectItem value="0+">0 Rh(+)</SelectItem>
                                                    <SelectItem value="0-">0 Rh(-)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="meslek" render={({ field }) => (
                                        <FormItem><FormLabel>Meslek</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="referans" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Referans</FormLabel>
                                            <FormControl>
                                                <ReferenceInput value={field.value || ''} onChange={field.onChange} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </TabsContent>

                            {/* Tab 2: İletişim */}
                            <TabsContent value="iletisim" className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="cep_tel" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cep Telefonu</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="+90 5XX XXX XX XX"
                                                    {...field}
                                                    onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                                                    onFocus={(e) => {
                                                        if (!e.target.value) field.onChange('+90 ');
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="email" render={({ field }) => (
                                        <FormItem><FormLabel>E-posta</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="ev_tel" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Ev Telefonu</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="+90 XXX XXX XX XX"
                                                    {...field}
                                                    onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                                                    onFocus={(e) => {
                                                        if (!e.target.value) field.onChange('+90 ');
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="is_tel" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>İş Telefonu</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="+90 XXX XXX XX XX"
                                                    {...field}
                                                    onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                                                    onFocus={(e) => {
                                                        if (!e.target.value) field.onChange('+90 ');
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </TabsContent>

                            {/* Tab 3: Adres */}
                            <TabsContent value="adres" className="space-y-4 pt-4">
                                <FormField control={form.control} name="adres" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Adres Detayı</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                className="min-h-[120px]"
                                                placeholder="Mahalle, Sokak, Kapı No, İlçe, İl..."
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </TabsContent>

                            {/* Tab 4: Notlar */}
                            <TabsContent value="notlar" className="space-y-4 pt-4">
                                <FormField control={form.control} name="kimlik_notlar" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Genel Notlar</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                className="min-h-[150px]"
                                                placeholder="Hasta hakkında genel notlar..."
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </TabsContent>

                        </Tabs>

                        <div className="flex justify-end pt-6 border-t">
                            <Button type="button" variant="outline" className="mr-2" onClick={() => setOpen(false)}>
                                İptal
                            </Button>
                            <Button type="submit" disabled={createPatientMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                                {createPatientMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Kaydet
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
