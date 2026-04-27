import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const credentialFile = path.join(rootDir, "supabase", "demo-seed-credentials.json");

function readEnvFile() {
  const envPath = path.join(rootDir, ".env.local");
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  return Object.fromEntries(
    lines
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const env = readEnvFile();

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const demoUsers = [
  {
    name: "Rahul Verma",
    email: "rahul.manager@acmdemo.com",
    mobile: "+91 9876501001",
    role: "manager",
    password: "Shris@Manager01",
    hourlyRate: 1450,
  },
  {
    name: "Sneha Iyer",
    email: "sneha.manager@acmdemo.com",
    mobile: "+91 9876501002",
    role: "manager",
    password: "Shris@Manager02",
    hourlyRate: 1525,
  },
  {
    name: "Aman Patel",
    email: "aman.employee@acmdemo.com",
    mobile: "+91 9876502001",
    role: "employee",
    password: "Shris@Employee01",
    hourlyRate: 650,
  },
  {
    name: "Priya Nair",
    email: "priya.employee@acmdemo.com",
    mobile: "+91 9876502002",
    role: "employee",
    password: "Shris@Employee02",
    hourlyRate: 675,
  },
];

async function ensureUser(user) {
  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list.data.users.find((item) => item.email?.toLowerCase() === user.email.toLowerCase());
  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, {
      password: user.password,
      user_metadata: {
        name: user.name,
        full_name: user.name,
        mobile_no: user.mobile,
      },
    });
    return existing;
  }

  const created = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      name: user.name,
      full_name: user.name,
      mobile_no: user.mobile,
    },
  });

  if (created.error || !created.data.user) {
    throw new Error(created.error?.message || `Unable to create ${user.email}`);
  }
  return created.data.user;
}

async function run() {
  const { data: companies, error: companyError } = await supabase
    .from("companies")
    .select("id, name, code, owner_user_id")
    .limit(1);

  if (companyError || !companies?.length) {
    throw new Error(companyError?.message || "No company found to seed");
  }

  const company = companies[0];

  const clientPayloads = [
    {
      company_id: company.id,
      name: "Skyline Estates",
      address: "Tower 8, Bannerghatta Road, Bengaluru",
      contact: "Karthik Menon",
      email: "projects@skylineestates.com",
    },
    {
      company_id: company.id,
      name: "Vertex Infra",
      address: "17 Business Bay, Hyderabad",
      contact: "Nidhi Rao",
      email: "ops@vertexinfra.com",
    },
  ];

  const clientIds = {};
  for (const client of clientPayloads) {
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("company_id", company.id)
      .eq("name", client.name)
      .maybeSingle();

    if (existing?.id) {
      clientIds[client.name] = existing.id;
      continue;
    }

    const { data, error } = await supabase.from("clients").insert(client).select("id").single();
    if (error || !data) throw new Error(error?.message || `Unable to create client ${client.name}`);
    clientIds[client.name] = data.id;
  }

  const projectPayloads = [
    {
      company_id: company.id,
      client_id: clientIds["Skyline Estates"],
      name: "Luxury Tower Phase 2",
      location: "Bengaluru",
      start_date: "2026-04-01",
      end_date: null,
      contract_value: 25000000,
    },
    {
      company_id: company.id,
      client_id: clientIds["Vertex Infra"],
      name: "Metro Depot Civil Upgrade",
      location: "Hyderabad",
      start_date: "2026-03-15",
      end_date: null,
      contract_value: 18600000,
    },
  ];

  const projectIds = {};
  for (const project of projectPayloads) {
    const { data: existing } = await supabase
      .from("projects")
      .select("id, job_number")
      .eq("company_id", company.id)
      .eq("name", project.name)
      .maybeSingle();

    if (existing?.id) {
      projectIds[project.name] = existing.id;
      continue;
    }

    const { data, error } = await supabase
      .from("projects")
      .insert(project)
      .select("id, job_number")
      .single();

    if (error || !data) throw new Error(error?.message || `Unable to create project ${project.name}`);
    projectIds[project.name] = data.id;
  }

  const seededUsers = [];
  for (const user of demoUsers) {
    const authUser = await ensureUser(user);

    const personPayload = {
      name: user.name,
      contact: user.mobile,
      email: user.email,
      address: user.role === "manager" ? "Manager Residence, Bengaluru" : "Employee Residence, Bengaluru",
    };

    let personId = null;
    const { data: existingPerson } = await supabase
      .from("people")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();

    if (existingPerson?.id) {
      personId = existingPerson.id;
      await supabase.from("people").update(personPayload).eq("id", personId);
    } else {
      const { data, error } = await supabase.from("people").insert(personPayload).select("id").single();
      if (error || !data) throw new Error(error?.message || `Unable to create person ${user.email}`);
      personId = data.id;
    }

    const employeeManagerEmail =
      user.email === "aman.employee@acmdemo.com"
        ? "rahul.manager@acmdemo.com"
        : user.email === "priya.employee@acmdemo.com"
          ? "sneha.manager@acmdemo.com"
          : null;

    const employeeManager = employeeManagerEmail
      ? seededUsers.find((entry) => entry.email === employeeManagerEmail)
      : null;

    const projectId =
      user.email === "rahul.manager@acmdemo.com" || user.email === "aman.employee@acmdemo.com"
        ? projectIds["Luxury Tower Phase 2"]
        : projectIds["Metro Depot Civil Upgrade"];

    const membershipPayload = {
      company_id: company.id,
      user_id: authUser.id,
      role: user.role,
      person_id: personId,
      mobile_no: user.mobile,
      hourly_rate: user.hourlyRate,
      created_by_user_id: employeeManager?.userId || company.owner_user_id,
      created_in_project_id: user.role === "employee" ? projectId : null,
    };

    const { data: membership, error: membershipError } = await supabase
      .from("company_users")
      .upsert(membershipPayload)
      .select("user_id, role, user_code")
      .single();

    if (membershipError || !membership) throw new Error(membershipError?.message || `Unable to upsert membership ${user.email}`);

    const projectRole = user.role === "manager" ? "manager" : "employee";

    const { error: assignmentError } = await supabase
      .from("project_users")
      .upsert({
        project_id: projectId,
        user_id: authUser.id,
        role: projectRole,
        hourly_rate: user.hourlyRate,
      });

    if (assignmentError) throw new Error(assignmentError.message || `Unable to assign project ${user.email}`);

    seededUsers.push({
      userId: authUser.id,
      companyId: company.id,
      name: user.name,
      role: user.role,
      email: user.email,
      password: user.password,
      userCode: membership.user_code,
      projectId,
    });
  }

  const tasks = [
    {
      company_id: company.id,
      project_id: projectIds["Luxury Tower Phase 2"],
      assigned_to_user_id: seededUsers.find((u) => u.email === "rahul.manager@acmdemo.com").userId,
      assigned_to_role: "manager",
      title: "Review slab casting schedule",
      description: "Validate manpower and material readiness for Tower B slab casting.",
      due_date: "2026-04-28",
      status: "assigned",
      assigned_by_user_id: company.owner_user_id,
    },
  ];

  for (const staff of seededUsers) {
    if (staff.role === "employee") {
      const managerEmail = staff.email === "aman.employee@acmdemo.com" ? "rahul.manager@acmdemo.com" : "sneha.manager@acmdemo.com";
      const managerUser = seededUsers.find((u) => u.email === managerEmail);
      tasks.push({
        company_id: company.id,
        project_id: staff.projectId,
        assigned_to_user_id: seededUsers.find((u) => u.email === staff.email).userId,
        assigned_to_role: "employee",
        title: `${staff.name.split(" ")[0]} daily site update`,
        description: "Upload today progress update and quality check notes.",
        due_date: "2026-04-27",
        status: staff.email === "aman.employee@acmdemo.com" ? "submitted" : "assigned",
        assigned_by_user_id: managerUser?.userId || company.owner_user_id,
        submitted_at: staff.email === "aman.employee@acmdemo.com" ? new Date().toISOString() : null,
      });
    }
  }

  for (const task of tasks) {
    const { data: existing } = await supabase
      .from("tasks")
      .select("id")
      .eq("project_id", task.project_id)
      .eq("title", task.title)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("tasks")
        .update({
          description: task.description,
          due_date: task.due_date,
          status: task.status,
          assigned_to_user_id: task.assigned_to_user_id,
          assigned_to_role: task.assigned_to_role,
          assigned_by_user_id: task.assigned_by_user_id,
          submitted_at: task.submitted_at ?? null,
        })
        .eq("id", existing.id);
    } else {
      const { error } = await supabase.from("tasks").insert(task);
      if (error) throw new Error(error.message || `Unable to create task ${task.title}`);
    }
  }

  fs.writeFileSync(
    credentialFile,
    JSON.stringify(
      seededUsers.map((item) => ({
        userId: item.userId,
        companyId: item.companyId,
        email: item.email,
        password: item.password,
        userCode: item.userCode,
        password_sent_at: null,
      })),
      null,
      2
    )
  );

  console.log(JSON.stringify({
    company: company.name,
    users: seededUsers.map((item) => ({
      role: item.role,
      email: item.email,
      password: item.password,
      userCode: item.userCode,
    })),
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
