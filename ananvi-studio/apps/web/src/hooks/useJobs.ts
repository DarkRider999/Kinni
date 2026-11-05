import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { IJob, IClip, IPaginatedResponse, IApiResponse, CaptionStyle, AIVideoStyle } from '@ananvi/shared';

export function useJobs(page = 1) {
  return useQuery<IPaginatedResponse<IJob>>({
    queryKey: ['jobs', page],
    queryFn: () => api.get('/jobs', { params: { page } }).then(r => r.data),
    refetchInterval: 5000, // Poll for progress
  });
}

export function useJob(id: string) {
  return useQuery<IApiResponse<IJob>>({
    queryKey: ['job', id],
    queryFn: () => api.get(`/jobs/${id}`).then(r => r.data),
    refetchInterval: (query) => {
      const data = query.state.data?.data;
      return data && ['queued', 'processing'].includes(data.status) ? 2000 : false;
    },
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      source_url: string;
      clip_count?: number;
      caption_style?: CaptionStyle;
      caption_language?: string;
      ai_video_style?: AIVideoStyle;
    }) => api.post('/jobs', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });
}

export function useCancelJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/jobs/${id}/cancel`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });
}

export function useJobClips(jobId: string | undefined) {
  return useQuery<IApiResponse<IClip[]>>({
    queryKey: ['job-clips', jobId],
    queryFn: () => api.get(`/clips/job/${jobId}`).then(r => r.data),
    enabled: !!jobId,
  });
}
