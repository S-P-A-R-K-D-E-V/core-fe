import { _jobs } from 'src/_mock/_job';

import { JobDetailsView } from 'src/sections/job/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Job Details',
};

type Props = {
  params: {
    id: string;
  };
};

export default function JobDetailsPage({ params }: Props) {
  const { id } = params;

  return <JobDetailsView id={id} />;
}

// Commented out to avoid build-time API call
// export async function generateStaticParams() {
//   return _jobs.map((job) => ({
//     id: job.id,
//   }));
// }
